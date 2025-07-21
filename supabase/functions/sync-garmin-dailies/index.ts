import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for the response
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Interface for Garmin daily summary
interface GarminDailySummary {
  summaryId: string;
  calendarDate: string;
  startTimeInSeconds: number;
  startTimeOffsetInSeconds: number;
  activityType: string;
  durationInSeconds: number;
  steps?: number;
  pushes?: number;
  distanceInMeters?: number;
  pushDistanceInMeters?: number;
  activeTimeInSeconds?: number;
  activeKilocalories?: number;
  bmrKilocalories?: number;
  moderateIntensityDurationInSeconds?: number;
  vigorousIntensityDurationInSeconds?: number;
  floorsClimbed?: number;
  minHeartRateInBeatsPerMinute?: number;
  averageHeartRateInBeatsPerMinute?: number;
  maxHeartRateInBeatsPerMinute?: number;
  restingHeartRateInBeatsPerMinute?: number;
  timeOffsetHeartRateSamples?: Record<string, number>;
  averageStressLevel?: number;
  maxStressLevel?: number;
  stressDurationInSeconds?: number;
  restStressDurationInSeconds?: number;
  activityStressDurationInSeconds?: number;
  lowStressDurationInSeconds?: number;
  mediumStressDurationInSeconds?: number;
  highStressDurationInSeconds?: number;
  stressQualifier?: string;
  stepsGoal?: number;
  pushesGoal?: number;
  intensityDurationGoalInSeconds?: number;
  floorsClimbedGoal?: number;
}

interface SyncResult {
  success: boolean;
  syncedCount: number;
  errorCount: number;
  errors?: any[];
  triggeredBy: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let syncId: string | null = null;

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      console.log('[sync-garmin-dailies] No request body, treating as manual sync');
    }

    // Get the authorization header and extract user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[sync-garmin-dailies] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const triggeredBy = isWebhookTriggered ? 'webhook' : 'manual';
    console.log(`[sync-garmin-dailies] Sync request for user ${user.id} triggered by: ${triggeredBy}${callbackURL ? `, callback: ${callbackURL}` : ''}`);

    // Check rate limiting for this user and sync type
    const { data: canSync } = await supabase.rpc('can_sync_user', {
      user_id_param: user.id,
      sync_type_param: 'dailies',
      min_interval_minutes: 5
    });

    if (!canSync && !requestBody.force_sync) {
      console.log('[sync-garmin-dailies] Rate limit exceeded, sync skipped');
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
    const { data: loggedSyncId } = await supabase.rpc('log_sync_attempt', {
      user_id_param: user.id,
      sync_type_param: 'dailies',
      triggered_by_param: triggeredBy,
      webhook_payload_param: webhookPayload,
      callback_url_param: callbackURL
    });
    
    syncId = loggedSyncId;

    console.log(`Starting daily summaries sync for user: ${user.id}`);

    // Get user's Garmin tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      console.error('[sync-garmin-dailies] Token error:', tokenError);
      
      if (syncId) {
        await supabase.rpc('update_sync_status', {
          sync_id_param: syncId,
          status_param: 'failed'
        });
      }
      
      return new Response(
        JSON.stringify({ error: 'Garmin tokens not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if token needs refresh
    if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
      console.log('[sync-garmin-dailies] Token expired, refreshing...');
      
      // Call garmin-oauth function to refresh token
      const { data: refreshData, error: refreshError } = await supabase.functions.invoke('garmin-oauth', {
        body: {
          action: 'refresh',
          user_id: user.id
        }
      });

      if (refreshError) {
        console.error('[sync-garmin-dailies] Token refresh error:', refreshError);
        
        if (syncId) {
          await supabase.rpc('update_sync_status', {
            sync_id_param: syncId,
            status_param: 'failed'
          });
        }
        
        return new Response(
          JSON.stringify({ error: 'Failed to refresh token' }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Update tokenData with new values
      tokenData.access_token = refreshData.access_token;
      tokenData.token_secret = refreshData.token_secret;
    }

    // Define time range - use webhook callback URL if available, otherwise last 24 hours
    let startTime: number;
    let endTime: number;
    
    if (callbackURL) {
      console.log(`[sync-garmin-dailies] Using webhook callback URL: ${callbackURL}`);
      // If using callback URL, just fetch recent data
      endTime = Math.floor(Date.now() / 1000);
      startTime = endTime - (24 * 60 * 60); // Last 24 hours
    } else {
      // Standard time range for manual sync
      endTime = Math.floor(Date.now() / 1000);
      startTime = endTime - (24 * 60 * 60); // Last 24 hours
    }

    console.log(`Fetching daily summaries from ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);

    // Use Bearer token for API call
    const garminUrl = callbackURL || `https://apis.garmin.com/wellness-api/rest/dailies?uploadStartTimeInSeconds=${startTime}&uploadEndTimeInSeconds=${endTime}`;

    // Fetch daily summaries from Garmin API
    console.log('Fetching from Garmin API...');
    const response = await fetch(garminUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sync-garmin-dailies] Garmin API error:', response.status, errorText);
      
      if (syncId) {
        await supabase.rpc('update_sync_status', {
          sync_id_param: syncId,
          status_param: 'failed'
        });
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch from Garmin API',
          status: response.status,
          details: errorText
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const dailySummaries: GarminDailySummary[] = await response.json();
    console.log(`Fetched ${dailySummaries.length} daily summaries from Garmin API`);

    const syncResult: SyncResult = {
      success: true,
      syncedCount: 0,
      errorCount: 0,
      errors: [],
      triggeredBy: triggeredBy
    };

    // Process and store each daily summary
    for (const summary of dailySummaries) {
      try {
        const summaryData = {
          user_id: user.id,
          summary_id: summary.summaryId,
          calendar_date: summary.calendarDate,
          start_time_in_seconds: summary.startTimeInSeconds,
          start_time_offset_in_seconds: summary.startTimeOffsetInSeconds,
          activity_type: summary.activityType,
          duration_in_seconds: summary.durationInSeconds,
          steps: summary.steps,
          pushes: summary.pushes,
          distance_in_meters: summary.distanceInMeters,
          push_distance_in_meters: summary.pushDistanceInMeters,
          active_time_in_seconds: summary.activeTimeInSeconds,
          active_kilocalories: summary.activeKilocalories,
          bmr_kilocalories: summary.bmrKilocalories,
          moderate_intensity_duration_in_seconds: summary.moderateIntensityDurationInSeconds,
          vigorous_intensity_duration_in_seconds: summary.vigorousIntensityDurationInSeconds,
          floors_climbed: summary.floorsClimbed,
          min_heart_rate_in_beats_per_minute: summary.minHeartRateInBeatsPerMinute,
          average_heart_rate_in_beats_per_minute: summary.averageHeartRateInBeatsPerMinute,
          max_heart_rate_in_beats_per_minute: summary.maxHeartRateInBeatsPerMinute,
          resting_heart_rate_in_beats_per_minute: summary.restingHeartRateInBeatsPerMinute,
          time_offset_heart_rate_samples: summary.timeOffsetHeartRateSamples || null,
          average_stress_level: summary.averageStressLevel,
          max_stress_level: summary.maxStressLevel,
          stress_duration_in_seconds: summary.stressDurationInSeconds,
          rest_stress_duration_in_seconds: summary.restStressDurationInSeconds,
          activity_stress_duration_in_seconds: summary.activityStressDurationInSeconds,
          low_stress_duration_in_seconds: summary.lowStressDurationInSeconds,
          medium_stress_duration_in_seconds: summary.mediumStressDurationInSeconds,
          high_stress_duration_in_seconds: summary.highStressDurationInSeconds,
          stress_qualifier: summary.stressQualifier,
          steps_goal: summary.stepsGoal,
          pushes_goal: summary.pushesGoal,
          intensity_duration_goal_in_seconds: summary.intensityDurationGoalInSeconds,
          floors_climbed_goal: summary.floorsClimbedGoal
        };

        const { error: upsertError } = await supabase
          .from('garmin_daily_summaries')
          .upsert(summaryData, {
            onConflict: 'user_id,summary_id'
          });

        if (upsertError) {
          console.error('[sync-garmin-dailies] Error upserting daily summary:', upsertError);
          syncResult.errorCount++;
          syncResult.errors?.push({
            summaryId: summary.summaryId,
            error: upsertError.message
          });
        } else {
          console.log(`Successfully synced daily summary: ${summary.summaryId}`);
          syncResult.syncedCount++;
        }
      } catch (error) {
        console.error('[sync-garmin-dailies] Error processing daily summary:', error);
        syncResult.errorCount++;
        syncResult.errors?.push({
          summaryId: summary.summaryId,
          error: error.message
        });
      }
    }

    // Update sync status to completed
    if (syncId) {
      await supabase.rpc('update_sync_status', {
        sync_id_param: syncId,
        status_param: 'completed'
      });
    }

    console.log(`Sync completed: ${syncResult.syncedCount} synced, ${syncResult.errorCount} errors`);

    return new Response(
      JSON.stringify(syncResult),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[sync-garmin-dailies] Sync error:', error);
    
    // Update sync status to failed
    try {
      if (syncId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase.rpc('update_sync_status', {
          sync_id_param: syncId,
          status_param: 'failed'
        });
      }
    } catch (statusError) {
      console.error('[sync-garmin-dailies] Failed to update sync status:', statusError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});