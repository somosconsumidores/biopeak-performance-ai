
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  timeRange: 'last_30_days' | 'custom';
  start?: number;
  end?: number;
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

    console.log('[backfill-activities] Function started');

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
      console.error('[backfill-activities] Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[backfill-activities] User authenticated:', user.id);

    // Parse request body
    let requestBody: BackfillRequest;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's Garmin tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('access_token, expires_at, garmin_user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('[backfill-activities] Token error:', tokenError);
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

    // Calculate time range
    let startTime: number;
    let endTime: number;

    if (requestBody.timeRange === 'last_30_days') {
      endTime = Math.floor(Date.now() / 1000);
      startTime = endTime - (30 * 24 * 60 * 60); // 30 days ago
    } else if (requestBody.timeRange === 'custom') {
      if (!requestBody.start || !requestBody.end) {
        return new Response(JSON.stringify({ error: 'Custom range requires start and end timestamps' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      startTime = requestBody.start;
      endTime = requestBody.end;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid timeRange. Must be "last_30_days" or "custom"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[backfill-activities] Processing range from ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);

    // First, handle activities backfill (synchronous)
    const activitiesResult = await handleActivitiesBackfill(supabase, user.id, tokenData, startTime, endTime);
    
    // Then, trigger activity details backfill (asynchronous)
    const detailsResult = await triggerActivityDetailsBackfill(supabase, user.id, tokenData, startTime, endTime);

    return new Response(JSON.stringify({
      success: true,
      activities: activitiesResult,
      activityDetails: detailsResult,
      message: 'Backfill completed. Activity details will be delivered via webhook in a few minutes.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[backfill-activities] Unexpected error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleActivitiesBackfill(supabase: any, userId: string, tokenData: any, startTime: number, endTime: number) {
  const MAX_TIME_RANGE = 86400; // 24 hours in seconds
  const DELAY_BETWEEN_REQUESTS = 100; // 100ms delay between requests

  let allActivities: any[] = [];
  let processedChunks = 0;
  let failedChunks = 0;

  // Process in 24-hour chunks
  for (let currentEndTime = endTime; currentEndTime > startTime; currentEndTime -= MAX_TIME_RANGE) {
    const currentStartTime = Math.max(currentEndTime - MAX_TIME_RANGE, startTime);
    
    console.log(`[backfill-activities] Processing activities chunk ${processedChunks + 1}...`);
    
    try {
      const apiUrl = new URL('https://apis.garmin.com/wellness-api/rest/activities');
      apiUrl.searchParams.append('uploadStartTimeInSeconds', currentStartTime.toString());
      apiUrl.searchParams.append('uploadEndTimeInSeconds', currentEndTime.toString());

      const garminResponse = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      });

      if (!garminResponse.ok) {
        const errorText = await garminResponse.text();
        console.error(`[backfill-activities] Activities API error for chunk ${processedChunks + 1}:`, garminResponse.status, errorText);
        failedChunks++;
        processedChunks++;
        
        if (currentStartTime > startTime) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
        }
        continue;
      }

      const chunkActivities = await garminResponse.json();
      console.log(`[backfill-activities] Fetched ${chunkActivities.length} activities for chunk ${processedChunks + 1}`);
      
      allActivities = allActivities.concat(chunkActivities);
      processedChunks++;

      if (currentStartTime > startTime) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }

    } catch (error) {
      console.error(`[backfill-activities] Error processing activities chunk ${processedChunks + 1}:`, error);
      failedChunks++;
      processedChunks++;
      
      if (currentStartTime > startTime) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    }
  }

  // Deduplicate and save activities
  const activityMap = new Map();
  allActivities.forEach(activity => {
    const existing = activityMap.get(activity.summaryId);
    if (!existing || (activity.startTimeInSeconds || 0) > (existing.startTimeInSeconds || 0)) {
      activityMap.set(activity.summaryId, activity);
    }
  });
  
  const uniqueActivities = Array.from(activityMap.values());
  let savedActivities = 0;

  if (uniqueActivities.length > 0) {
    const activitiesToInsert = uniqueActivities.map(activity => ({
      user_id: userId,
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

    const { data: insertedData, error: insertError } = await supabase
      .from('garmin_activities')
      .upsert(activitiesToInsert, { 
        onConflict: 'user_id,summary_id',
        ignoreDuplicates: false 
      })
      .select('id');

    if (!insertError) {
      savedActivities = insertedData?.length || 0;
    }
  }

  return {
    found: uniqueActivities.length,
    saved: savedActivities,
    chunksProcessed: processedChunks,
    chunksFailed: failedChunks
  };
}

async function triggerActivityDetailsBackfill(supabase: any, userId: string, tokenData: any, startTime: number, endTime: number) {
  const MAX_TIME_RANGE = 30 * 24 * 60 * 60; // 30 days in seconds (Garmin's max)
  const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay between requests

  let triggeredRequests = 0;
  let failedRequests = 0;
  const backfillRequestIds: string[] = [];

  // Process in 30-day chunks for activity details
  for (let currentEndTime = endTime; currentEndTime > startTime; currentEndTime -= MAX_TIME_RANGE) {
    const currentStartTime = Math.max(currentEndTime - MAX_TIME_RANGE, startTime);
    
    console.log(`[backfill-activities] Triggering activity details backfill for period ${new Date(currentStartTime * 1000).toISOString()} to ${new Date(currentEndTime * 1000).toISOString()}`);
    
    try {
      // Record the backfill request in the database
      const { data: backfillRecord, error: recordError } = await supabase
        .from('garmin_backfill_requests')
        .insert({
          user_id: userId,
          garmin_user_id: tokenData.garmin_user_id,
          request_type: 'activity_details',
          time_range_start: currentStartTime,
          time_range_end: currentEndTime,
          status: 'triggered'
        })
        .select('id')
        .single();

      if (recordError) {
        console.error('[backfill-activities] Error recording backfill request:', recordError);
        failedRequests++;
        continue;
      }

      // Trigger the asynchronous backfill
      const apiUrl = new URL('https://apis.garmin.com/wellness-api/rest/backfill/activityDetails');
      apiUrl.searchParams.append('summaryStartTimeInSeconds', currentStartTime.toString());
      apiUrl.searchParams.append('summaryEndTimeInSeconds', currentEndTime.toString());

      const garminResponse = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      });

      if (garminResponse.ok) {
        // Empty response is expected for backfill trigger
        console.log(`[backfill-activities] Activity details backfill triggered successfully for period`);
        
        // Update status to in_progress
        await supabase
          .from('garmin_backfill_requests')
          .update({ status: 'in_progress' })
          .eq('id', backfillRecord.id);
          
        backfillRequestIds.push(backfillRecord.id);
        triggeredRequests++;
      } else if (garminResponse.status === 409) {
        // Duplicate request - this period was already requested
        console.log(`[backfill-activities] Activity details backfill already processed for this period`);
        
        await supabase
          .from('garmin_backfill_requests')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString(),
            error_message: 'Duplicate request - period already processed'
          })
          .eq('id', backfillRecord.id);
          
        triggeredRequests++;
      } else {
        const errorText = await garminResponse.text();
        console.error(`[backfill-activities] Activity details API error:`, garminResponse.status, errorText);
        
        await supabase
          .from('garmin_backfill_requests')
          .update({ 
            status: 'failed',
            error_message: `API error: ${garminResponse.status} - ${errorText}`
          })
          .eq('id', backfillRecord.id);
          
        failedRequests++;
      }

      // Delay between requests
      if (currentStartTime > startTime) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }

    } catch (error) {
      console.error(`[backfill-activities] Error triggering activity details backfill:`, error);
      failedRequests++;
      
      if (currentStartTime > startTime) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    }
  }

  return {
    triggered: triggeredRequests,
    failed: failedRequests,
    backfillRequestIds: backfillRequestIds,
    message: 'Activity details backfill triggered. Data will arrive via webhook notifications.'
  };
}
