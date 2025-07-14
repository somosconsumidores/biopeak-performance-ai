import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[sync-garmin-activities] Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[sync-garmin-activities] Syncing activities for user:', user.id);

    // Get user's Garmin tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('access_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('[sync-garmin-activities] Token error:', tokenError);
      return new Response(JSON.stringify({ error: 'No Garmin token found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if token is expired
    if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
      return new Response(JSON.stringify({ error: 'Garmin token expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[sync-garmin-activities] Fetching activities from Garmin API...');

    // Garmin API limits time range to 86400 seconds (24 hours)
    const MAX_TIME_RANGE = 86400; // 24 hours in seconds
    const DAYS_TO_SYNC = 30; // Sync last 30 days
    const DELAY_BETWEEN_REQUESTS = 100; // 100ms delay between requests

    const endTime = Math.floor(Date.now() / 1000);
    const totalStartTime = endTime - (DAYS_TO_SYNC * 24 * 60 * 60);

    let allActivities: GarminActivity[] = [];
    let processedDays = 0;
    let failedDays = 0;

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
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json',
          },
        });

        if (!garminResponse.ok) {
          const errorText = await garminResponse.text();
          console.error(`[sync-garmin-activities] Garmin API error for day ${processedDays + 1}:`, garminResponse.status, errorText);
          failedDays++;
          
          // Continue with other days even if one fails
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

    return new Response(JSON.stringify({
      message: `Activities synced successfully. Processed ${processedDays} days${failedDays > 0 ? `, ${failedDays} days failed` : ''}.`,
      synced: syncedCount,
      total: activities.length,
      daysProcessed: processedDays,
      daysFailed: failedDays
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-garmin-activities] Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});