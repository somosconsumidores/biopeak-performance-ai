import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GarminActivityDetail {
  activityId: string
  summaryId: string
  activitySummary: {
    activityType: string
    deviceName: string
    uploadTimeInSeconds: number
    startTimeInSeconds: number
    durationInSeconds: number
    distance?: number
    calories?: number
    averageHeartRateInBeatsPerMinute?: number
    maxHeartRateInBeatsPerMinute?: number
    averageSpeedInMetersPerSecond?: number
    maxSpeedInMetersPerSecond?: number
    elevationGainInMeters?: number
    elevationLossInMeters?: number
    [key: string]: any
  }
  samples?: Array<{
    timestampInSeconds: number
    heartRate?: number
    speed?: number
    distance?: number
    altitude?: number
    cadence?: number
    power?: number
    [key: string]: any
  }>
}

interface SyncResult {
  message: string;
  synced: number;
  total: number;
}

interface SyncError {
  error: string;
  details?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[sync-activity-details] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[sync-activity-details] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    console.log(`[sync-activity-details] Processing request for user: ${user.id}`);

    // Get user's Garmin tokens
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('garmin_tokens')
      .select('access_token, token_secret, consumer_key, expires_at')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      console.error('[sync-activity-details] No Garmin token found:', tokenError);
      return new Response(
        JSON.stringify({ error: 'No Garmin token found. Please connect your Garmin account.' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Check if token is expired
    const currentTime = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    if (currentTime >= expiresAt) {
      console.log('[sync-activity-details] Token expired, attempting refresh...');
      
      // Try to refresh the token by calling garmin-oauth function
      const { data: refreshData, error: refreshError } = await supabaseClient.functions.invoke('garmin-oauth', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: {
          refresh_token: tokenData.token_secret,
          grant_type: 'refresh_token'
        }
      });

      if (refreshError || !refreshData?.success) {
        console.error('[sync-activity-details] Token refresh failed:', refreshError);
        return new Response(
          JSON.stringify({ error: 'Garmin token expired and refresh failed. Please reconnect your Garmin account.' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        );
      }

      // Update token data with refreshed token
      tokenData.access_token = refreshData.access_token;
      console.log('[sync-activity-details] Token refreshed successfully');
    }

    // Parse request body for time range
    const body = await req.json().catch(() => ({}));
    const uploadStartTime = body.uploadStartTimeInSeconds;
    const uploadEndTime = body.uploadEndTimeInSeconds;

    // If no time range provided, use last 24 hours
    const now = Math.floor(Date.now() / 1000);
    const startTime = uploadStartTime || (now - 86400); // 24 hours ago
    const endTime = uploadEndTime || now;

    console.log(`[sync-activity-details] Fetching activity details from ${startTime} to ${endTime}`);

    // Build Garmin API URL
    const garminUrl = new URL('https://apis.garmin.com/wellness-api/rest/activityDetails');
    garminUrl.searchParams.append('uploadStartTimeInSeconds', startTime.toString());
    garminUrl.searchParams.append('uploadEndTimeInSeconds', endTime.toString());

    // Create OAuth 1.0 signature
    const clientId = Deno.env.get('GARMIN_CLIENT_ID');
    const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('[sync-activity-details] Missing Garmin credentials');
      return new Response(
        JSON.stringify({ error: 'Missing Garmin API credentials' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    // Generate OAuth 1.0 Authorization header
    const oauthTimestamp = Math.floor(Date.now() / 1000);
    const oauthNonce = crypto.randomUUID().replace(/-/g, '');

    const oauthParams = {
      oauth_consumer_key: clientId,
      oauth_token: tokenData.access_token,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: oauthTimestamp.toString(),
      oauth_nonce: oauthNonce,
      oauth_version: '1.0'
    };

    // Create parameter string for signature
    const allParams = {
      ...oauthParams,
      uploadStartTimeInSeconds: startTime.toString(),
      uploadEndTimeInSeconds: endTime.toString()
    };

    const paramString = Object.keys(allParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
      .join('&');

    const signatureBaseString = `GET&${encodeURIComponent(garminUrl.origin + garminUrl.pathname)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(clientSecret)}&${encodeURIComponent(tokenData.token_secret || '')}`;

    // Generate HMAC-SHA1 signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signingKey),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureBaseString));
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

    // Create Authorization header
    const authHeaderValue = 'OAuth ' + Object.entries({
      ...oauthParams,
      oauth_signature: signatureBase64
    }).map(([key, value]) => `${key}="${encodeURIComponent(value)}"`).join(', ');

    // Make request to Garmin API
    console.log('[sync-activity-details] Making request to Garmin API...');
    const response = await fetch(garminUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': authHeaderValue,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sync-activity-details] Garmin API error:', response.status, errorText);
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Garmin token expired', details: 'Please reconnect your Garmin account' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to fetch activity details from Garmin', details: errorText }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    const activityDetails: GarminActivityDetail[] = await response.json();
    console.log(`[sync-activity-details] Received ${activityDetails.length} activity details from Garmin`);

    if (activityDetails.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No activity details found for the specified time range', synced: 0, total: 0 }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Process and store activity details
    let syncedCount = 0;
    const errors: string[] = [];

    for (const detail of activityDetails) {
      try {
        const { error: upsertError } = await supabaseClient
          .from('garmin_activity_details')
          .upsert({
            user_id: user.id,
            activity_id: detail.activityId,
            summary_id: detail.summaryId,
            upload_time_in_seconds: detail.activitySummary.uploadTimeInSeconds,
            start_time_in_seconds: detail.activitySummary.startTimeInSeconds,
            duration_in_seconds: detail.activitySummary.durationInSeconds,
            activity_type: detail.activitySummary.activityType,
            device_name: detail.activitySummary.deviceName,
            samples: detail.samples || null,
            activity_summary: detail.activitySummary,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,summary_id'
          });

        if (upsertError) {
          console.error('[sync-activity-details] Error upserting activity detail:', upsertError);
          errors.push(`Failed to store activity ${detail.activityId}: ${upsertError.message}`);
        } else {
          syncedCount++;
        }
      } catch (error) {
        console.error('[sync-activity-details] Unexpected error processing activity detail:', error);
        errors.push(`Unexpected error processing activity ${detail.activityId}`);
      }
    }

    const result = {
      message: `Successfully synced ${syncedCount} of ${activityDetails.length} activity details`,
      synced: syncedCount,
      total: activityDetails.length,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('[sync-activity-details] Sync completed:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[sync-activity-details] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});