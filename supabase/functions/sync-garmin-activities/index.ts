import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import { GarminTokenManager } from '../_shared/garmin-token-manager.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GarminActivity {
  summaryId: string;
  activityId: string;
  activityType?: string;
  startTimeInSeconds?: number;
  startTimeOffsetInSeconds?: number;
  durationInSeconds?: number;
  distanceInMeters?: number;
  activeKilocalories?: number;
  deviceName?: string;
  averageHeartRateInBeatsPerMinute?: number;
  maxHeartRateInBeatsPerMinute?: number;
  averageSpeedInMetersPerSecond?: number;
  maxSpeedInMetersPerSecond?: number;
  averagePaceInMinutesPerKilometer?: number;
  maxPaceInMinutesPerKilometer?: number;
  averageBikeCadenceInRoundsPerMinute?: number;
  maxBikeCadenceInRoundsPerMinute?: number;
  averageRunCadenceInStepsPerMinute?: number;
  maxRunCadenceInStepsPerMinute?: number;
  averagePushCadenceInPushesPerMinute?: number;
  maxPushCadenceInPushesPerMinute?: number;
  averageSwimCadenceInStrokesPerMinute?: number;
  startingLatitudeInDegree?: number;
  startingLongitudeInDegree?: number;
  totalElevationGainInMeters?: number;
  totalElevationLossInMeters?: number;
  steps?: number;
  pushes?: number;
  numberOfActiveLengths?: number;
  isParent?: boolean;
  parentSummaryId?: string;
  manual?: boolean;
  isWebUpload?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let syncId: any = null;
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body to check for webhook trigger and parameters
    let requestBody: any = {};
    let isWebhookTriggered = false;
    let isManualSync = false;
    let callbackURL: string | null = null;
    let webhookPayload: any = null;
    let webhookUserId: string | null = null;
    let garminAccessToken: string | null = null;

    try {
      requestBody = await req.json();
      isWebhookTriggered = requestBody.webhook_triggered || false;
      isManualSync = requestBody.manual_sync || requestBody.force_sync || false;
      callbackURL = requestBody.callback_url || null;
      webhookPayload = requestBody.webhook_payload || null;
      webhookUserId = requestBody.user_id || null;
      garminAccessToken = requestBody.garmin_access_token || null;
    } catch (e) {
      console.log('[sync-garmin-activities] No request body provided');
    }

    // ONLY allow webhook-triggered calls to prevent unprompted pull notifications
    if (!isWebhookTriggered) {
      console.log('[sync-garmin-activities] REJECTED: Only webhook-triggered syncs allowed to prevent unprompted pull notifications');
      return new Response(JSON.stringify({ 
        error: 'Sync rejected: Only webhook-triggered syncs are allowed',
        details: 'Manual syncing has been disabled to prevent Garmin unprompted pull notifications. This endpoint only accepts calls from Garmin webhooks.',
        code: 'WEBHOOK_ONLY'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let user: any = null;

    // For webhook calls, we use service role and get user from request body
    if (isWebhookTriggered && webhookUserId) {
      console.log(`[sync-garmin-activities] Webhook call for user: ${webhookUserId}`);
      
      // Verify user exists in database
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', webhookUserId)
        .maybeSingle();

      if (userError || !userData) {
        console.error('[sync-garmin-activities] User not found:', userError);
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      user = { id: webhookUserId };
    } else {
      // For manual sync, require proper JWT authentication
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'No authorization header' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify the user with JWT
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (authError || !authUser) {
        console.error('[sync-garmin-activities] Auth error:', authError);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      user = authUser;
    }

    const triggeredBy = isWebhookTriggered ? 'webhook' : 'manual_sync';
    console.log(`[sync-garmin-activities] ACCEPTED: Sync request for user ${user.id} triggered by: ${triggeredBy}${callbackURL ? `, callback: ${callbackURL}` : ''}`);

    // Check rate limiting - ONLY for manual syncs, webhooks have priority
    if (!isWebhookTriggered) {
      const minInterval = 5; // 5 minutes for manual syncs
      const { data: canSync } = await supabase.rpc('can_sync_user', {
        user_id_param: user.id,
        sync_type_param: 'activities',
        min_interval_minutes: minInterval
      });

      if (!canSync) {
        console.log('[sync-garmin-activities] Rate limit exceeded for manual sync, sync skipped');
        return new Response(JSON.stringify({ 
          error: 'Sync rate limit exceeded',
          message: `Please wait ${minInterval} minutes between manual sync requests`,
          canRetryAfter: minInterval * 60 * 1000,
          rateLimited: true
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.log('[sync-garmin-activities] WEBHOOK SYNC - Bypassing rate limits for real-time updates');
    }

    // Log sync attempt
    try {
      const { data } = await supabase.rpc('log_sync_attempt', {
        user_id_param: user.id,
        sync_type_param: 'activities',
        triggered_by_param: triggeredBy,
        webhook_payload_param: webhookPayload,
        callback_url_param: callbackURL
      });
      syncId = data;
    } catch (logError) {
      console.error('[sync-garmin-activities] Failed to log sync attempt:', logError);
    }

    console.log('[sync-garmin-activities] Syncing activities for user:', user.id);

    let allActivities: GarminActivity[] = [];
    let processedDays = 0;
    let failedDays = 0;

    // WEBHOOK MODE: Process activities from webhook payload directly
    if (isWebhookTriggered && webhookPayload) {
      console.log('[sync-garmin-activities] WEBHOOK MODE: Processing activity from webhook payload');
      console.log(`[sync-garmin-activities] Webhook payload:`, JSON.stringify(webhookPayload, null, 2));
      
      // Handle both single activity (from webhook) and activities array (from backfill)
      let activitiesToProcess = [];
      
      if (Array.isArray(webhookPayload.activities)) {
        // Backfill format: { activities: [...] }
        activitiesToProcess = webhookPayload.activities;
        console.log(`[sync-garmin-activities] Processing backfill format with ${activitiesToProcess.length} activities`);
      } else if (webhookPayload.summaryId || webhookPayload.activityId) {
        // Single activity from webhook: activity object directly
        activitiesToProcess = [webhookPayload];
        console.log(`[sync-garmin-activities] Processing single activity from webhook: ${webhookPayload.summaryId}`);
      } else {
        console.error('[sync-garmin-activities] Invalid webhook payload format:', webhookPayload);
        return new Response(JSON.stringify({ 
          error: 'Invalid webhook payload format',
          details: 'Expected either activities array or single activity object'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Transform webhook activities to our format
      for (const webhookActivity of activitiesToProcess) {
        try {
          console.log(`[sync-garmin-activities] Processing webhook activity:`, JSON.stringify(webhookActivity, null, 2));
          
          // Convert webhook activity format to GarminActivity format
          const activity: GarminActivity = {
            summaryId: webhookActivity.summaryId || webhookActivity.activityId,
            activityId: webhookActivity.activityId || webhookActivity.summaryId,
            activityType: webhookActivity.activityType,
            startTimeInSeconds: webhookActivity.startTimeInSeconds,
            startTimeOffsetInSeconds: webhookActivity.startTimeOffsetInSeconds,
            durationInSeconds: webhookActivity.durationInSeconds,
            distanceInMeters: webhookActivity.distanceInMeters,
            activeKilocalories: webhookActivity.activeKilocalories,
            deviceName: webhookActivity.deviceName,
            averageHeartRateInBeatsPerMinute: webhookActivity.averageHeartRateInBeatsPerMinute,
            maxHeartRateInBeatsPerMinute: webhookActivity.maxHeartRateInBeatsPerMinute,
            averageSpeedInMetersPerSecond: webhookActivity.averageSpeedInMetersPerSecond,
            maxSpeedInMetersPerSecond: webhookActivity.maxSpeedInMetersPerSecond,
            averagePaceInMinutesPerKilometer: webhookActivity.averagePaceInMinutesPerKilometer,
            maxPaceInMinutesPerKilometer: webhookActivity.maxPaceInMinutesPerKilometer,
            averageBikeCadenceInRoundsPerMinute: webhookActivity.averageBikeCadenceInRoundsPerMinute,
            maxBikeCadenceInRoundsPerMinute: webhookActivity.maxBikeCadenceInRoundsPerMinute,
            averageRunCadenceInStepsPerMinute: webhookActivity.averageRunCadenceInStepsPerMinute,
            maxRunCadenceInStepsPerMinute: webhookActivity.maxRunCadenceInStepsPerMinute,
            averagePushCadenceInPushesPerMinute: webhookActivity.averagePushCadenceInPushesPerMinute,
            maxPushCadenceInPushesPerMinute: webhookActivity.maxPushCadenceInPushesPerMinute,
            averageSwimCadenceInStrokesPerMinute: webhookActivity.averageSwimCadenceInStrokesPerMinute,
            startingLatitudeInDegree: webhookActivity.startingLatitudeInDegree,
            startingLongitudeInDegree: webhookActivity.startingLongitudeInDegree,
            totalElevationGainInMeters: webhookActivity.totalElevationGainInMeters,
            totalElevationLossInMeters: webhookActivity.totalElevationLossInMeters,
            steps: webhookActivity.steps,
            pushes: webhookActivity.pushes,
            numberOfActiveLengths: webhookActivity.numberOfActiveLengths,
            isParent: webhookActivity.isParent,
            parentSummaryId: webhookActivity.parentSummaryId,
            manual: webhookActivity.manual,
            isWebUpload: webhookActivity.isWebUpload,
          };
          
          allActivities.push(activity);
          console.log(`[sync-garmin-activities] Successfully processed webhook activity: ${activity.summaryId} (${activity.activityType})`);
        } catch (error) {
          console.error('[sync-garmin-activities] Error processing webhook activity:', error, webhookActivity);
          failedDays++;
        }
      }
      
      processedDays = 1; // Mark as processed from webhook
      console.log(`[sync-garmin-activities] WEBHOOK MODE COMPLETE: Processed ${allActivities.length} activities from webhook payload`);
      
    } else if (!isWebhookTriggered) {
      // MANUAL SYNC MODE: Fetch from Garmin API (only for manual syncs)
      console.log('[sync-garmin-activities] MANUAL SYNC MODE: Fetching activities from Garmin API...');
      
      // Get user's Garmin tokens with proactive refresh
      const tokenManager = new GarminTokenManager(supabaseUrl, supabaseKey);
      const validToken = await tokenManager.getValidAccessToken(user.id);

      if (!validToken) {
        console.error('[sync-garmin-activities] Could not obtain valid Garmin token');
        return new Response(JSON.stringify({ 
          error: 'No valid Garmin token available',
          details: 'Token may be expired or refresh failed. Please reconnect your Garmin account.'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accessToken = validToken;
      console.log('[sync-garmin-activities] Using valid Garmin token (proactively managed)');

      // Garmin API limits time range to 86400 seconds (24 hours)
      const MAX_TIME_RANGE = 86400; // 24 hours in seconds
      const DAYS_TO_SYNC = 30; // Sync last 30 days
      const DELAY_BETWEEN_REQUESTS = 100; // 100ms delay between requests

      const endTime = Math.floor(Date.now() / 1000);
      const totalStartTime = endTime - (DAYS_TO_SYNC * 24 * 60 * 60);

      // Process in 24-hour chunks, starting from most recent
      for (let currentEndTime = endTime; currentEndTime > totalStartTime; currentEndTime -= MAX_TIME_RANGE) {
        const currentStartTime = Math.max(currentEndTime - MAX_TIME_RANGE, totalStartTime);
        
        console.log(`[sync-garmin-activities] Processing day ${processedDays + 1}/${DAYS_TO_SYNC}...`);
        
        try {
          // Build URL with 24-hour time range
          const apiUrl = new URL('https://apis.garmin.com/wellness-api/rest/activities');
          apiUrl.searchParams.append('uploadStartTimeInSeconds', currentStartTime.toString());
          apiUrl.searchParams.append('uploadEndTimeInSeconds', currentEndTime.toString());

          console.log(`[sync-garmin-activities] Fetching from ${new Date(currentStartTime * 1000).toISOString()} to ${new Date(currentEndTime * 1000).toISOString()}`);

          // Fetch activities for this 24-hour period
          const garminResponse = await fetch(apiUrl.toString(), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });

          if (!garminResponse.ok) {
            const errorText = await garminResponse.text();
            console.error(`[sync-garmin-activities] Garmin API error for day ${processedDays + 1}:`, garminResponse.status, errorText);
            
            // If token error (401/403), try to refresh token once
            if (garminResponse.status === 401 || garminResponse.status === 403) {
              console.log('[sync-garmin-activities] Token error detected, attempting token refresh...');
              const refreshedToken = await tokenManager.refreshTokenIfNeeded(user.id);
              
              if (refreshedToken) {
                console.log('[sync-garmin-activities] Token refreshed, retrying API call...');
                // Retry the same request with new token
                const retryResponse = await fetch(apiUrl.toString(), {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${refreshedToken}`,
                    'Accept': 'application/json',
                  },
                });
                
                if (retryResponse.ok) {
                  const dayActivities: GarminActivity[] = await retryResponse.json();
                  console.log(`[sync-garmin-activities] Retry successful! Fetched ${dayActivities.length} activities for day ${processedDays + 1}`);
                  allActivities = allActivities.concat(dayActivities);
                  processedDays++;
                  
                  if (currentStartTime > totalStartTime) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
                  }
                  continue;
                } else {
                  console.error('[sync-garmin-activities] Retry also failed:', retryResponse.status);
                }
              }
            }
            
            failedDays++;
            processedDays++;
            
            // Add delay before next request
            if (currentStartTime > totalStartTime) {
              await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
            }
            continue;
          }

          const dayActivities: GarminActivity[] = await garminResponse.json();
          console.log(`[sync-garmin-activities] Fetched ${dayActivities.length} activities for day ${processedDays + 1}`);
          
          // Add activities to the total collection
          allActivities = allActivities.concat(dayActivities);
          processedDays++;

          // Add delay between requests to be respectful to the API
          if (currentStartTime > totalStartTime) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
          }

        } catch (error) {
          console.error(`[sync-garmin-activities] Error processing day ${processedDays + 1}:`, error);
          failedDays++;
          processedDays++;
          
          // Add delay before next request even on error
          if (currentStartTime > totalStartTime) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
          }
        }
      }
    } else {
      // Webhook triggered but no payload - this shouldn't happen
      console.error('[sync-garmin-activities] WEBHOOK ERROR: Triggered by webhook but no activities payload provided');
      return new Response(JSON.stringify({ 
        error: 'Webhook triggered but no activities payload provided',
        details: 'Expected webhook payload with activities array'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-garmin-activities] Completed sync: ${processedDays} days processed, ${failedDays} failed, ${allActivities.length} total activities`);
    
    // Deduplicate activities based on summary_id to prevent constraint conflicts
    const activityMap = new Map<string, GarminActivity>();
    let duplicatesRemoved = 0;
    
    for (const activity of allActivities) {
      const existingActivity = activityMap.get(activity.summaryId);
      if (existingActivity) {
        // Keep the activity with the most recent start time (or first one if no start time)
        const existingStartTime = existingActivity.startTimeInSeconds || 0;
        const currentStartTime = activity.startTimeInSeconds || 0;
        
        if (currentStartTime > existingStartTime) {
          activityMap.set(activity.summaryId, activity);
        }
        duplicatesRemoved++;
      } else {
        activityMap.set(activity.summaryId, activity);
      }
    }
    
    const activities = Array.from(activityMap.values());
    console.log(`[sync-garmin-activities] Removed ${duplicatesRemoved} duplicate activities. Final count: ${activities.length}`);

    if (activities.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No activities found',
        synced: 0,
        total: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transform and insert activities
    const activitiesToInsert = activities.map(activity => ({
      user_id: user.id,
      summary_id: activity.summaryId,
      activity_id: activity.activityId,
      activity_type: activity.activityType,
      start_time_in_seconds: activity.startTimeInSeconds,
      start_time_offset_in_seconds: activity.startTimeOffsetInSeconds,
      duration_in_seconds: activity.durationInSeconds,
      distance_in_meters: activity.distanceInMeters,
      active_kilocalories: activity.activeKilocalories,
      device_name: activity.deviceName,
      average_heart_rate_in_beats_per_minute: activity.averageHeartRateInBeatsPerMinute,
      max_heart_rate_in_beats_per_minute: activity.maxHeartRateInBeatsPerMinute,
      average_speed_in_meters_per_second: activity.averageSpeedInMetersPerSecond,
      max_speed_in_meters_per_second: activity.maxSpeedInMetersPerSecond,
      average_pace_in_minutes_per_kilometer: activity.averagePaceInMinutesPerKilometer,
      max_pace_in_minutes_per_kilometer: activity.maxPaceInMinutesPerKilometer,
      average_bike_cadence_in_rounds_per_minute: activity.averageBikeCadenceInRoundsPerMinute,
      max_bike_cadence_in_rounds_per_minute: activity.maxBikeCadenceInRoundsPerMinute,
      average_run_cadence_in_steps_per_minute: activity.averageRunCadenceInStepsPerMinute,
      max_run_cadence_in_steps_per_minute: activity.maxRunCadenceInStepsPerMinute,
      average_push_cadence_in_pushes_per_minute: activity.averagePushCadenceInPushesPerMinute,
      max_push_cadence_in_pushes_per_minute: activity.maxPushCadenceInPushesPerMinute,
      average_swim_cadence_in_strokes_per_minute: activity.averageSwimCadenceInStrokesPerMinute,
      starting_latitude_in_degree: activity.startingLatitudeInDegree,
      starting_longitude_in_degree: activity.startingLongitudeInDegree,
      total_elevation_gain_in_meters: activity.totalElevationGainInMeters,
      total_elevation_loss_in_meters: activity.totalElevationLossInMeters,
      steps: activity.steps,
      pushes: activity.pushes,
      number_of_active_lengths: activity.numberOfActiveLengths,
      is_parent: activity.isParent,
      parent_summary_id: activity.parentSummaryId,
      manual: activity.manual,
      is_web_upload: activity.isWebUpload,
    }));

    // Use upsert to handle duplicates
    const { data: insertedData, error: insertError } = await supabase
      .from('garmin_activities')
      .upsert(activitiesToInsert, { 
        onConflict: 'user_id,summary_id',
        ignoreDuplicates: false 
      })
      .select('id');

    if (insertError) {
      console.error('[sync-garmin-activities] Insert error:', insertError);
      
      // Update sync status to failed
      if (syncId) {
        await supabase.rpc('update_sync_status', {
          sync_id_param: syncId,
          status_param: 'failed'
        });
      }
      
      return new Response(JSON.stringify({ 
        error: 'Failed to save activities',
        details: insertError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const syncedCount = insertedData?.length || 0;
    console.log('[sync-garmin-activities] Successfully synced', syncedCount, 'activities');

    // Calculate statistics for newly synced activities
    for (const insertedActivity of insertedData || []) {
      try {
        await supabase.functions.invoke('calculate-statistics-metrics', {
          body: {
            activity_id: insertedActivity.id,
            user_id: user.id,
            source_activity: 'Garmin'
          }
        });
      } catch (statsError) {
        console.error(`Error calculating statistics for activity ${insertedActivity.id}:`, statsError);
        // Don't fail the main operation if stats calculation fails
      }
    }

    // Update sync status to completed
    if (syncId) {
      await supabase.rpc('update_sync_status', {
        sync_id_param: syncId,
        status_param: 'completed'
      });
    }

    return new Response(JSON.stringify({
      message: `Activities synced successfully. Processed ${processedDays} days${failedDays > 0 ? `, ${failedDays} days failed` : ''}.`,
      synced: syncedCount,
      total: activities.length,
      daysProcessed: processedDays,
      daysFailed: failedDays,
      triggeredBy: triggeredBy
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-garmin-activities] Unexpected error:', error);
    
    // Try to update sync status to failed if we have syncId
    try {
      if (syncId) {
        await supabase.rpc('update_sync_status', {
          sync_id_param: syncId,
          status_param: 'failed'
        });
      }
    } catch (statusError) {
      console.error('[sync-garmin-activities] Failed to update sync status:', statusError);
    }
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
