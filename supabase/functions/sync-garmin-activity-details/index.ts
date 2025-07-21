import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GarminActivityDetail {
  activityId: string
  summaryId: string
  activityName?: string
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
  triggeredBy: string;
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

  let syncId: string | null = null;

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body to check for webhook trigger
    let requestBody: any = {};
    let isWebhookTriggered = false;
    let callbackURL: string | null = null;
    let webhookPayload: any = null;

    try {
      requestBody = await req.json();
      isWebhookTriggered = requestBody.webhook_triggered || false;
      callbackURL = requestBody.callback_url || null;
      webhookPayload = requestBody.webhook_payload || null;
    } catch (e) {
      console.log('[sync-activity-details] No request body, treating as manual sync');
    }

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

    const triggeredBy = isWebhookTriggered ? 'webhook' : 'manual';
    console.log(`[sync-activity-details] Sync request for user ${user.id} triggered by: ${triggeredBy}${callbackURL ? `, callback: ${callbackURL}` : ''}`);

    // Check rate limiting for this user and sync type
    const { data: canSync } = await supabaseClient.rpc('can_sync_user', {
      user_id_param: user.id,
      sync_type_param: 'details',
      min_interval_minutes: 5
    });

    if (!canSync && !requestBody.force_sync) {
      console.log('[sync-activity-details] Rate limit exceeded, sync skipped');
      return new Response(JSON.stringify({ 
        error: 'Sync rate limit exceeded',
        message: 'Please wait 5 minutes between sync requests',
        canRetryAfter: 5 * 60 * 1000
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log sync attempt
    const { data: loggedSyncId } = await supabaseClient.rpc('log_sync_attempt', {
      user_id_param: user.id,
      sync_type_param: 'details',
      triggered_by_param: triggeredBy,
      webhook_payload_param: webhookPayload,
      callback_url_param: callbackURL
    });

    syncId = loggedSyncId;

    console.log(`[sync-activity-details] Processing request for user: ${user.id}`);

    // Get user's Garmin tokens
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('garmin_tokens')
      .select('access_token, token_secret, consumer_key, expires_at')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      console.error('[sync-activity-details] No Garmin token found:', tokenError);
      
      if (syncId) {
        await supabaseClient.rpc('update_sync_status', {
          sync_id_param: syncId,
          status_param: 'failed'
        });
      }
      
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
        
        if (syncId) {
          await supabaseClient.rpc('update_sync_status', {
            sync_id_param: syncId,
            status_param: 'failed'
          });
        }
        
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

    // Parse request body to get custom time range if provided
    let startTime: number;
    let endTime: number;
    
    if (callbackURL) {
      console.log(`[sync-activity-details] Using webhook callback URL: ${callbackURL}`);
      // For webhook with callback, use default range (last 24 hours)
      const now = Math.floor(Date.now() / 1000);
      startTime = now - 86400; // 24 hours ago
      endTime = now;
    } else if (requestBody.uploadStartTimeInSeconds && requestBody.uploadEndTimeInSeconds) {
      startTime = requestBody.uploadStartTimeInSeconds;
      endTime = requestBody.uploadEndTimeInSeconds;
      console.log(`[sync-activity-details] Using custom time range from ${startTime} to ${endTime}`);
    } else {
      // Fallback to last 24 hours from current time
      const now = Math.floor(Date.now() / 1000);
      startTime = now - 86400; // 24 hours ago
      endTime = now;
      console.log(`[sync-activity-details] Using default 24h range from ${startTime} to ${endTime}`);
    }

    console.log(`[sync-activity-details] Fetching activity details from ${startTime} to ${endTime}`);

    // Use callback URL if available, otherwise build standard API URL
    let apiUrl: string;
    if (callbackURL) {
      apiUrl = callbackURL;
    } else {
      const garminUrl = new URL('https://apis.garmin.com/wellness-api/rest/activityDetails');
      garminUrl.searchParams.append('uploadStartTimeInSeconds', startTime.toString());
      garminUrl.searchParams.append('uploadEndTimeInSeconds', endTime.toString());
      apiUrl = garminUrl.toString();
    }

    // Make request to Garmin API
    console.log('[sync-activity-details] Making request to Garmin API...');
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sync-activity-details] Garmin API error:', response.status, errorText);
      
      if (syncId) {
        await supabaseClient.rpc('update_sync_status', {
          sync_id_param: syncId,
          status_param: 'failed'
        });
      }
      
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
      // Update sync status to completed even with no data
      if (syncId) {
        await supabaseClient.rpc('update_sync_status', {
          sync_id_param: syncId,
          status_param: 'completed'
        });
      }
      
      return new Response(
        JSON.stringify({ 
          message: 'No activity details found for the specified time range', 
          synced: 0, 
          total: 0,
          triggeredBy: triggeredBy
        }),
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
        // Check if activity has required fields
        if (!detail.activityId || !detail.summaryId) {
          console.error('[sync-activity-details] Missing required fields for activity:', detail);
          errors.push(`Activity missing required fields: ${detail.activityId || 'unknown'}`);
          continue;
        }

        // Safe access to activitySummary properties
        const activitySummary = detail.activitySummary || {};
        const samples = detail.samples || [];
        
        // Extract activity name from the summary field
        const extractedActivityName = detail.summary?.activityName || detail.activityName || null;

        // If there are samples, save each sample as a separate row
        if (samples.length > 0) {
          for (const sample of samples) {
            const sampleTimestamp = sample.timestampInSeconds || activitySummary.startTimeInSeconds || null;
            
            const { error: upsertError } = await supabaseClient
              .from('garmin_activity_details')
              .upsert({
                user_id: user.id,
                activity_id: detail.activityId,
                summary_id: detail.summaryId,
                activity_name: extractedActivityName,
                upload_time_in_seconds: activitySummary.uploadTimeInSeconds || null,
                start_time_in_seconds: sampleTimestamp,
                duration_in_seconds: activitySummary.durationInSeconds || null,
                activity_type: activitySummary.activityType || null,
                device_name: activitySummary.deviceName || null,
                sample_timestamp: sampleTimestamp,
                samples: sample,
                activity_summary: activitySummary,
                heart_rate: sample.heartRate || null,
                latitude_in_degree: sample.latitudeInDegree || null,
                longitude_in_degree: sample.longitudeInDegree || null,
                elevation_in_meters: sample.elevationInMeters || null,
                speed_meters_per_second: sample.speedMetersPerSecond || null,
                power_in_watts: sample.powerInWatts || null,
                total_distance_in_meters: sample.totalDistanceInMeters || null,
                steps_per_minute: sample.stepsPerMinute || null,
                clock_duration_in_seconds: sample.clockDurationInSeconds || null,
                moving_duration_in_seconds: sample.movingDurationInSeconds || null,
                timer_duration_in_seconds: sample.timerDurationInSeconds || null,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'user_id,summary_id,sample_timestamp'
              });

            if (upsertError) {
              console.error('[sync-activity-details] Error upserting sample:', upsertError);
              errors.push(`Failed to store sample for activity ${detail.activityId}: ${upsertError.message}`);
            }
          }
          syncedCount++;
        } else {
          // If no samples, save just the activity summary
          const defaultTimestamp = activitySummary.startTimeInSeconds || activitySummary.uploadTimeInSeconds || null;
          
          const { error: upsertError } = await supabaseClient
            .from('garmin_activity_details')
            .upsert({
              user_id: user.id,
              activity_id: detail.activityId,
              summary_id: detail.summaryId,
              activity_name: extractedActivityName,
              upload_time_in_seconds: activitySummary.uploadTimeInSeconds || null,
              start_time_in_seconds: defaultTimestamp,
              duration_in_seconds: activitySummary.durationInSeconds || null,
              activity_type: activitySummary.activityType || null,
              device_name: activitySummary.deviceName || null,
              sample_timestamp: defaultTimestamp,
              samples: null,
              activity_summary: activitySummary,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,summary_id,sample_timestamp'
            });

          if (upsertError) {
            console.error('[sync-activity-details] Error upserting activity detail:', upsertError);
            errors.push(`Failed to store activity ${detail.activityId}: ${upsertError.message}`);
          } else {
            syncedCount++;
          }
        }
      } catch (error) {
        console.error('[sync-activity-details] Unexpected error processing activity detail:', error);
        errors.push(`Unexpected error processing activity ${detail.activityId || 'unknown'}`);
      }
    }

    // Update sync status to completed
    if (syncId) {
      await supabaseClient.rpc('update_sync_status', {
        sync_id_param: syncId,
        status_param: 'completed'
      });
    }

    const result = {
      message: `Successfully synced ${syncedCount} of ${activityDetails.length} activity details`,
      synced: syncedCount,
      total: activityDetails.length,
      triggeredBy: triggeredBy,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('[sync-activity-details] Sync completed:', result);

    // Trigger performance metrics calculation for synced activities (only if not webhook triggered to avoid loops)
    if (syncedCount > 0 && !isWebhookTriggered) {
      console.log('[sync-activity-details] Triggering performance metrics calculation...');
      
      const uniqueActivityIds = [...new Set(activityDetails.map(detail => detail.activityId))];
      
      for (const activityId of uniqueActivityIds) {
        try {
          const { error: metricsError } = await supabaseClient.functions.invoke('calculate-performance-metrics', {
            body: { 
              activity_id: activityId, 
              user_id: user.id 
            }
          });
          
          if (metricsError) {
            console.error(`[sync-activity-details] Error calculating metrics for ${activityId}:`, metricsError);
          } else {
            console.log(`[sync-activity-details] Metrics calculated for ${activityId}`);
          }
        } catch (metricsError) {
          console.error(`[sync-activity-details] Failed to trigger metrics calculation for ${activityId}:`, metricsError);
        }
      }
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[sync-activity-details] Unexpected error:', error);
    
    // Update sync status to failed
    try {
      if (syncId) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabaseClient.rpc('update_sync_status', {
          sync_id_param: syncId,
          status_param: 'failed'
        });
      }
    } catch (statusError) {
      console.error('[sync-activity-details] Failed to update sync status:', statusError);
    }
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});