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
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log(`Starting daily summaries sync for user: ${user.id}`);

    // Get user's Garmin tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('access_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('Token error:', tokenError);
      return new Response(
        JSON.stringify({ error: 'No Garmin token found' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if token is expired
    if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
      return new Response(
        JSON.stringify({ error: 'Garmin token expired' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Define time range (last 24 hours)
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (24 * 60 * 60); // 24 hours ago

    console.log(`Fetching daily summaries from ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);

    // Build URL for Garmin API
    const apiUrl = new URL('https://apis.garmin.com/wellness-api/rest/dailies');
    apiUrl.searchParams.append('uploadStartTimeInSeconds', startTime.toString());
    apiUrl.searchParams.append('uploadEndTimeInSeconds', endTime.toString());

    // Fetch daily summaries from Garmin API
    console.log('Fetching from Garmin API...');
    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Garmin API error:', response.status, errorText);
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
      errors: []
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
          console.error('Error upserting daily summary:', upsertError);
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
        console.error('Error processing daily summary:', error);
        syncResult.errorCount++;
        syncResult.errors?.push({
          summaryId: summary.summaryId,
          error: error.message
        });
      }
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
    console.error('Sync error:', error);
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