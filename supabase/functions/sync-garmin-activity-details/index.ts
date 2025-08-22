
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

// Background task for processing large datasets
async function processActivityDetailsInBackground(
  supabaseClient: any,
  userId: string,
  activityDetails: GarminActivityDetail[],
  syncId: string | null
) {
  console.log(`[bg-task] Starting background processing for ${activityDetails.length} activities`);
  
  let totalProcessed = 0;
  const errors: string[] = [];
  const BATCH_SIZE = 250; // Smaller batches to prevent statement timeouts
  
  for (const detail of activityDetails) {
    try {
      console.log(`[bg-task] Processing activity ${detail.activityId} with ${detail.samples?.length || 0} samples`);
      
      if (!detail.activityId || !detail.summaryId) {
        console.error('[bg-task] Missing required fields for activity:', detail);
        errors.push(`Activity missing required fields: ${detail.activityId || 'unknown'}`);
        continue;
      }

      const activitySummary = detail.activitySummary || {};
      const rawSamples = detail.samples || [];
      // Deduplicate samples by unified timestamp
      const samplesMap = new Map<number, any>();
      for (const s of rawSamples) {
        const ts = (s.startTimeInSeconds ?? s.timestampInSeconds ?? activitySummary.startTimeInSeconds ?? null);
        if (ts == null) continue;
        samplesMap.set(ts, s);
      }
      const samples = Array.from(samplesMap.values());
      const extractedActivityName = detail.summary?.activityName || detail.activityName || null;

      if (samples.length > 0) {
        console.log(`[bg-task] Processing ${samples.length} samples for activity ${detail.activityId}`);
        
        // Process samples in batches to avoid memory issues and timeouts
        for (let i = 0; i < samples.length; i += BATCH_SIZE) {
          const batch = samples.slice(i, i + BATCH_SIZE);
          console.log(`[bg-task] Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(samples.length/BATCH_SIZE)} (${batch.length} samples)`);
          
          const batchData = batch.map(sample => {
            const sampleTimestamp = (sample.startTimeInSeconds ?? sample.timestampInSeconds ?? activitySummary.startTimeInSeconds ?? null);
            
            return {
              user_id: userId,
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
            };
          });

          try {
            const { error: batchError } = await supabaseClient
              .from('garmin_activity_details')
              .upsert(batchData, {
                onConflict: 'user_id,summary_id,sample_timestamp'
              });

            if (batchError) {
              console.error(`[bg-task] Error upserting batch for activity ${detail.activityId}:`, batchError);
              errors.push(`Failed to store batch for activity ${detail.activityId}: ${batchError.message}`);
            } else {
              console.log(`[bg-task] Successfully processed batch of ${batch.length} samples`);
            }
          } catch (batchErr) {
            console.error(`[bg-task] Unexpected error processing batch:`, batchErr);
            errors.push(`Unexpected error processing batch for activity ${detail.activityId}`);
          }
        }
      } else {
        // Activity without samples - store summary only
        const defaultTimestamp = activitySummary.startTimeInSeconds || activitySummary.uploadTimeInSeconds || null;
        
        const { error: summaryError } = await supabaseClient
          .from('garmin_activity_details')
          .upsert({
            user_id: userId,
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

        if (summaryError) {
          console.error(`[bg-task] Error upserting activity summary:`, summaryError);
          errors.push(`Failed to store activity ${detail.activityId}: ${summaryError.message}`);
        }
      }
      
      totalProcessed++;
      
      // Log progress every 10 activities
      if (totalProcessed % 10 === 0) {
        console.log(`[bg-task] Progress: ${totalProcessed}/${activityDetails.length} activities processed`);
      }
      
    } catch (error) {
      console.error(`[bg-task] Unexpected error processing activity detail:`, error);
      errors.push(`Unexpected error processing activity ${detail.activityId || 'unknown'}`);
    }
  }

  console.log(`[bg-task] Background processing completed: ${totalProcessed}/${activityDetails.length} processed, ${errors.length} errors`);
  
  // Update sync status
  if (syncId) {
    try {
      await supabaseClient.rpc('update_sync_status', {
        sync_id_param: syncId,
        status_param: 'completed'
      });
      console.log(`[bg-task] Updated sync status for sync_id: ${syncId}`);
    } catch (statusError) {
      console.error(`[bg-task] Failed to update sync status:`, statusError);
    }
  }
  
  return { processed: totalProcessed, total: activityDetails.length, errors };
}

// Function to process activity details from webhook payload
async function processWebhookActivityDetails(
  supabaseClient: any,
  userId: string,
  activityDetails: GarminActivityDetail[],
  syncId: string | null
) {
  console.log(`[webhook-process] Processing ${activityDetails.length} activity details from webhook`);
  
  let totalProcessed = 0;
  const errors: string[] = [];
  const BATCH_SIZE = 250;
  
  for (const detail of activityDetails) {
    try {
      console.log(`[webhook-process] Processing activity ${detail.activityId} with ${detail.samples?.length || 0} samples`);
      
      if (!detail.activityId || !detail.summaryId) {
        console.error('[webhook-process] Missing required fields for activity:', detail);
        errors.push(`Activity missing required fields: ${detail.activityId || 'unknown'}`);
        continue;
      }

      const activitySummary = detail.activitySummary || {};
      const rawSamples = detail.samples || [];
      // Deduplicate samples by unified timestamp
      const samplesMap = new Map<number, any>();
      for (const s of rawSamples) {
        const ts = (s.startTimeInSeconds ?? s.timestampInSeconds ?? activitySummary.startTimeInSeconds ?? null);
        if (ts == null) continue;
        samplesMap.set(ts, s);
      }
      const samples = Array.from(samplesMap.values());
      const extractedActivityName = detail.activityName || activitySummary.activityName || null;

      if (samples.length > 0) {
        console.log(`[webhook-process] Processing ${samples.length} samples for activity ${detail.activityId}`);
        
        // Process samples in batches
        for (let i = 0; i < samples.length; i += BATCH_SIZE) {
          const batch = samples.slice(i, i + BATCH_SIZE);
          console.log(`[webhook-process] Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(samples.length/BATCH_SIZE)} (${batch.length} samples)`);
          
          const batchData = batch.map(sample => {
            // Use startTimeInSeconds from sample or fallback to summary
            const sampleTimestamp = (sample.startTimeInSeconds ?? sample.timestampInSeconds ?? activitySummary.startTimeInSeconds ?? null);
            
            return {
              user_id: userId,
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
            };
          });

          try {
            const { error: batchError } = await supabaseClient
              .from('garmin_activity_details')
              .upsert(batchData, {
                onConflict: 'user_id,summary_id,sample_timestamp'
              });

            if (batchError) {
              console.error(`[webhook-process] Error upserting batch for activity ${detail.activityId}:`, batchError);
              errors.push(`Failed to store batch for activity ${detail.activityId}: ${batchError.message}`);
            } else {
              console.log(`[webhook-process] Successfully processed batch of ${batch.length} samples`);
            }
          } catch (batchErr) {
            console.error(`[webhook-process] Unexpected error processing batch:`, batchErr);
            errors.push(`Unexpected error processing batch for activity ${detail.activityId}`);
          }
        }
      } else {
        // Activity without samples - store summary only
        const defaultTimestamp = activitySummary.startTimeInSeconds || activitySummary.uploadTimeInSeconds || null;
        
        const { error: summaryError } = await supabaseClient
          .from('garmin_activity_details')
          .upsert({
            user_id: userId,
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

        if (summaryError) {
          console.error(`[webhook-process] Error upserting activity summary:`, summaryError);
          errors.push(`Failed to store activity ${detail.activityId}: ${summaryError.message}`);
        }
      }
      
      totalProcessed++;
      
    } catch (error) {
      console.error(`[webhook-process] Unexpected error processing activity detail:`, error);
      errors.push(`Unexpected error processing activity ${detail.activityId || 'unknown'}`);
    }
  }

  console.log(`[webhook-process] Webhook processing completed: ${totalProcessed}/${activityDetails.length} processed, ${errors.length} errors`);
  
  return { processed: totalProcessed, total: activityDetails.length, errors };
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
    let isAdminOverride = false;
    let callbackURL: string | null = null;
    let webhookPayload: any = null;
    let specificActivityId: string | null = null;
    let specificSummaryId: string | null = null;
    let webhookUserId: string | null = null;
    let garminAccessToken: string | null = null;

    try {
      requestBody = await req.json();
      isWebhookTriggered = requestBody.webhook_triggered || false;
      isAdminOverride = requestBody.admin_override || false;
      callbackURL = requestBody.callback_url || null;
      webhookPayload = requestBody.webhook_payload || null;
      specificActivityId = requestBody.activity_id || null;
      specificSummaryId = requestBody.summary_id || null;
      webhookUserId = requestBody.user_id || null;
      garminAccessToken = requestBody.garmin_access_token || null;
    } catch (e) {
      console.log('[sync-activity-details] No request body provided');
    }

    // ACCEPT webhook calls and admin override
    if (!isWebhookTriggered && !isAdminOverride) {
      console.log('[sync-activity-details] REJECTED: Call not from webhook or admin override');
      return new Response(JSON.stringify({ 
        error: 'Sync rejected: Only webhook-triggered syncs are allowed',
        details: 'This endpoint only accepts calls from Garmin webhooks. Manual syncing has been disabled to prevent unprompted notifications.',
        code: 'WEBHOOK_ONLY'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let user: any = null;

    // For webhook calls, we use service role and get user from request body
    if (isWebhookTriggered && webhookUserId) {
      console.log(`[sync-activity-details] Webhook call for user: ${webhookUserId}`);
      
      // Verify user exists in database
      const { data: userData, error: userError } = await supabaseClient
        .from('profiles')
        .select('user_id')
        .eq('user_id', webhookUserId)
        .maybeSingle();

      if (userError || !userData) {
        console.error('[sync-activity-details] User not found:', userError);
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      user = { id: webhookUserId };
    } else {
      // For admin override, use proper JWT authentication
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
      const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token);

      if (authError || !authUser) {
        console.error('[sync-activity-details] Auth error:', authError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        );
      }

      user = authUser;
    }

    const triggeredBy = isWebhookTriggered ? 'webhook' : (isAdminOverride ? 'admin_override' : 'unknown');
    console.log(`[sync-activity-details] ACCEPTED: Sync request for user ${user.id} triggered by: ${triggeredBy}${callbackURL ? `, callback: ${callbackURL}` : ''}${specificActivityId ? `, activity: ${specificActivityId}` : ''}`);

    // Check rate limiting - ONLY for admin overrides, webhooks have absolute priority
    if (!isWebhookTriggered) {
      const minInterval = 30; // 30 minutes for admin override syncs
      const { data: canSync } = await supabaseClient.rpc('can_sync_user', {
        user_id_param: user.id,
        sync_type_param: 'details',
        min_interval_minutes: minInterval
      });

      if (!canSync) {
        console.log('[sync-activity-details] Rate limit exceeded for admin override sync, sync rejected');
        return new Response(JSON.stringify({ 
          error: 'Sync rate limit exceeded',
          message: `Please wait ${minInterval} minutes between admin sync requests`,
          canRetryAfter: minInterval * 60 * 1000,
          rateLimited: true
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.log('[sync-activity-details] WEBHOOK SYNC - Bypassing all rate limits for real-time activity details');
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

    // Get user's Garmin tokens (use webhook token if provided)
    let accessToken: string;
    let tokenData: any = null;
    
    if (isWebhookTriggered && garminAccessToken) {
      console.log('[sync-activity-details] Using Garmin token from webhook');
      accessToken = garminAccessToken;
    } else {
      // Get token from database for admin override
      const { data: dbTokenData, error: tokenError } = await supabaseClient
        .from('garmin_tokens')
        .select('access_token, token_secret, consumer_key, expires_at')
        .eq('user_id', user.id)
        .single();

      if (tokenError || !dbTokenData) {
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

      tokenData = dbTokenData;
      accessToken = tokenData.access_token;

      // Check if token is expired
      const currentTime = new Date();
      const expiresAt = new Date(tokenData.expires_at);
      if (currentTime >= expiresAt) {
        console.log('[sync-activity-details] Token expired, attempting refresh...');
        
        // Try to refresh the token by calling garmin-oauth function
        const { data: refreshData, error: refreshError } = await supabaseClient.functions.invoke('garmin-oauth', {
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
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
        accessToken = refreshData.access_token;
        console.log('[sync-activity-details] Token refreshed successfully');
      }
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

    console.log(`[sync-activity-details] Fetching activity details from ${startTime} to ${endTime}${specificActivityId ? ` for activity: ${specificActivityId}` : ''}`);

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

    // For webhooks, use the provided payload data instead of making API requests
    // This prevents "unprompted pull notifications" from Garmin
    if (isWebhookTriggered && webhookPayload) {
      console.log('[sync-activity-details] WEBHOOK MODE: Using provided payload data, skipping API request to prevent unprompted notifications');
      
      // Process webhook payload directly
      const activityDetails: GarminActivityDetail[] = [];
      
      // Handle both direct webhook format and activity details format
      if (webhookPayload.summary && webhookPayload.samples) {
        // Direct activity details format from webhook
        activityDetails.push({
          activityId: webhookPayload.activityId || webhookPayload.summaryId?.replace('-detail', ''),
          summaryId: webhookPayload.summaryId,
          activityName: webhookPayload.summary?.activityName,
          activitySummary: webhookPayload.summary,
          samples: webhookPayload.samples
        });
      } else if (webhookPayload.activityDetails && Array.isArray(webhookPayload.activityDetails)) {
        // Multiple activity details format
        for (const detail of webhookPayload.activityDetails) {
          if (detail.summary && detail.samples) {
            activityDetails.push({
              activityId: detail.activityId || detail.summaryId?.replace('-detail', ''),
              summaryId: detail.summaryId,
              activityName: detail.summary?.activityName,
              activitySummary: detail.summary,
              samples: detail.samples
            });
          }
        }
      }
      
      console.log(`[sync-activity-details] Processed ${activityDetails.length} activity details from webhook payload`);
      
      if (activityDetails.length > 0) {
        // Process the webhook data directly without making API calls
        await processWebhookActivityDetails(supabaseClient, user.id, activityDetails, syncId);
        
        console.log(`[sync-activity-details] Sync completed: {
  message: "Successfully synced ${activityDetails.length} of ${activityDetails.length} activity details",
  synced: ${activityDetails.length},
  total: ${activityDetails.length},
  triggeredBy: "${triggeredBy}",
  errors: undefined
}`);
        
        // Update sync status to completed
        if (syncId) {
          await supabaseClient.rpc('update_sync_status', {
            sync_id_param: syncId,
            status_param: 'completed'
          });
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: `Successfully synced ${activityDetails.length} of ${activityDetails.length} activity details`,
          synced: activityDetails.length,
          total: activityDetails.length,
          triggeredBy: triggeredBy
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        console.log('[sync-activity-details] No valid activity details found in webhook payload');
        
        if (syncId) {
          await supabaseClient.rpc('update_sync_status', {
            sync_id_param: syncId,
            status_param: 'completed'
          });
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: 'No activity details to process',
          synced: 0,
          total: 0,
          triggeredBy: triggeredBy
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // For admin overrides or non-webhook calls, make request to Garmin API
    console.log('[sync-activity-details] ADMIN MODE: Making request to Garmin API...');
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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

    // Filter by specific activity if provided
    let filteredDetails = activityDetails;
    if (specificActivityId) {
      filteredDetails = activityDetails.filter(detail => detail.activityId === specificActivityId);
      console.log(`[sync-activity-details] Filtered to ${filteredDetails.length} details for activity ${specificActivityId}`);
    }
    if (specificSummaryId) {
      filteredDetails = filteredDetails.filter(detail => detail.summaryId === specificSummaryId);
      console.log(`[sync-activity-details] Filtered to ${filteredDetails.length} details for summary ${specificSummaryId}`);
    }

    if (filteredDetails.length === 0) {
      // Update sync status to completed even with no data
      if (syncId) {
        await supabaseClient.rpc('update_sync_status', {
          sync_id_param: syncId,
          status_param: 'completed'
        });
      }
      
      return new Response(
        JSON.stringify({ 
          message: 'No activity details found for the specified criteria', 
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

    // Calculate total samples to determine processing approach
    const totalSamples = filteredDetails.reduce((sum, detail) => sum + (detail.samples?.length || 0), 0);
    console.log(`[sync-activity-details] Total samples to process: ${totalSamples}`);

    // Use background processing for large datasets (>1000 samples) or multiple activities
    const useBackgroundProcessing = totalSamples > 1000 || filteredDetails.length > 5;
    
    if (useBackgroundProcessing) {
      console.log(`[sync-activity-details] Using background processing for ${totalSamples} samples`);
      
      // Return immediate response to prevent timeout
      const immediateResponse = new Response(
        JSON.stringify({ 
          message: `Started background processing of ${filteredDetails.length} activity details with ${totalSamples} samples`, 
          synced: 0, 
          total: filteredDetails.length,
          triggeredBy: triggeredBy,
          background_processing: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 202 // Accepted - processing in background
        }
      );

      // Start background processing
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      EdgeRuntime.waitUntil(
        processActivityDetailsInBackground(supabaseClient, user.id, filteredDetails, syncId)
      );

      return immediateResponse;
    }

    // For smaller datasets, process synchronously (existing logic)
    let syncedCount = 0;
    const errors: string[] = [];

    for (const detail of filteredDetails) {
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
      message: `Successfully synced ${syncedCount} of ${filteredDetails.length} activity details`,
      synced: syncedCount,
      total: filteredDetails.length,
      triggeredBy: triggeredBy,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('[sync-activity-details] Sync completed:', result);

    // Trigger performance metrics calculation for synced activities (only if not webhook triggered to avoid loops)
    if (syncedCount > 0 && !isWebhookTriggered) {
      console.log('[sync-activity-details] Triggering performance metrics calculation...');
      
      const uniqueActivityIds = [...new Set(filteredDetails.map(detail => detail.activityId))];
      
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
