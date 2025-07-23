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

interface GarminActivityDetail {
  activityId: string;
  summaryId: string;
  activityName?: string;
  samples?: any[];
  activitySummary?: any;
}

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

    // Get user's Garmin tokens including garmin_user_id
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

    console.log(`[backfill-activities] Fetching activities from ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);

    // Log backfill attempt with garmin_user_id
    const { data: logData } = await supabase
      .from('garmin_webhook_logs')
      .insert({
        user_id: user.id,
        garmin_user_id: tokenData.garmin_user_id,
        webhook_type: 'backfill',
        payload: {
          timeRange: requestBody.timeRange,
          startTime,
          endTime,
          startDate: new Date(startTime * 1000).toISOString(),
          endDate: new Date(endTime * 1000).toISOString()
        },
        status: 'processing'
      })
      .select('id')
      .single();

    const logId = logData?.id;

    // Fetch activities in 24-hour chunks (same logic as sync-garmin-activities)
    const MAX_TIME_RANGE = 86400; // 24 hours in seconds
    const DELAY_BETWEEN_REQUESTS = 100; // 100ms delay between requests

    let allActivities: GarminActivity[] = [];
    let processedChunks = 0;
    let failedChunks = 0;

    // Process in 24-hour chunks, starting from most recent
    for (let currentEndTime = endTime; currentEndTime > startTime; currentEndTime -= MAX_TIME_RANGE) {
      const currentStartTime = Math.max(currentEndTime - MAX_TIME_RANGE, startTime);
      
      console.log(`[backfill-activities] Processing chunk ${processedChunks + 1}...`);
      
      try {
        // Build URL with 24-hour time range
        const apiUrl = new URL('https://apis.garmin.com/wellness-api/rest/activities');
        apiUrl.searchParams.append('uploadStartTimeInSeconds', currentStartTime.toString());
        apiUrl.searchParams.append('uploadEndTimeInSeconds', currentEndTime.toString());

        console.log(`[backfill-activities] Fetching from ${new Date(currentStartTime * 1000).toISOString()} to ${new Date(currentEndTime * 1000).toISOString()}`);

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
          console.error(`[backfill-activities] Garmin API error for chunk ${processedChunks + 1}:`, garminResponse.status, errorText);
          failedChunks++;
          
          // Continue with other chunks even if one fails
          processedChunks++;
          
          // Add delay before next request
          if (currentStartTime > startTime) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
          }
          continue;
        }

        const chunkActivities: GarminActivity[] = await garminResponse.json();
        console.log(`[backfill-activities] Fetched ${chunkActivities.length} activities for chunk ${processedChunks + 1}`);
        
        // Add activities to the total collection
        allActivities = allActivities.concat(chunkActivities);
        processedChunks++;

        // Add delay between requests to be respectful to the API
        if (currentStartTime > startTime) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
        }

      } catch (error) {
        console.error(`[backfill-activities] Error processing chunk ${processedChunks + 1}:`, error);
        failedChunks++;
        processedChunks++;
        
        // Add delay before next request even on error
        if (currentStartTime > startTime) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
        }
      }
    }

    console.log(`[backfill-activities] Completed backfill: ${processedChunks} chunks processed, ${failedChunks} failed, ${allActivities.length} total activities`);
    
    // Deduplicate activities based on summary_id
    const activityMap = new Map<string, GarminActivity>();
    let duplicatesRemoved = 0;
    
    for (const activity of allActivities) {
      const existingActivity = activityMap.get(activity.summaryId);
      if (existingActivity) {
        // Keep the activity with the most recent start time
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
    console.log(`[backfill-activities] Removed ${duplicatesRemoved} duplicate activities. Final count: ${activities.length}`);

    let savedActivities = 0;

    if (activities.length > 0) {
      // Transform and insert activities (same logic as sync-garmin-activities)
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
        console.error('[backfill-activities] Insert error:', insertError);
        
        // Update log status to failed
        if (logId) {
          await supabase
            .from('garmin_webhook_logs')
            .update({ status: 'failed', error_message: insertError.message })
            .eq('id', logId);
        }
        
        return new Response(JSON.stringify({ 
          error: 'Failed to save activities',
          details: insertError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      savedActivities = insertedData?.length || 0;
    }

    console.log('[backfill-activities] Successfully saved', savedActivities, 'activities');

    // Activity details backfill
    let savedActivityDetails = 0;
    let activityDetailsFailedChunks = 0;
    
    console.log('[backfill-activities] Starting activity details backfill...');
    
    if (activities.length > 0) {
      // Process activity details in chunks for the same time range
      for (let currentEndTime = endTime; currentEndTime > startTime; currentEndTime -= MAX_TIME_RANGE) {
        const currentStartTime = Math.max(currentEndTime - MAX_TIME_RANGE, startTime);
        
        console.log(`[backfill-activities] Processing activity details chunk...`);
        
        try {
          // Build URL for activity details with time range - using push endpoint since push is configured
          const detailsUrl = new URL('https://apis.garmin.com/wellness-api/rest/push/activityDetails');
          detailsUrl.searchParams.append('summaryStartTimeInSeconds', currentStartTime.toString());
          detailsUrl.searchParams.append('summaryEndTimeInSeconds', currentEndTime.toString());

          console.log(`[backfill-activities] Fetching activity details from ${new Date(currentStartTime * 1000).toISOString()} to ${new Date(currentEndTime * 1000).toISOString()}`);

          // Fetch activity details for this time period
          const detailsResponse = await fetch(detailsUrl.toString(), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Accept': 'application/json',
            },
          });

          if (!detailsResponse.ok) {
            const errorText = await detailsResponse.text();
            
            // Handle 409 (duplicate backfill) as expected behavior, not an error
            if (detailsResponse.status === 409) {
              console.log(`[backfill-activities] Activity details already processed for this time range:`, errorText);
            } else {
              console.error(`[backfill-activities] Activity details API error:`, detailsResponse.status, errorText);
              activityDetailsFailedChunks++;
            }
            
            // Add delay before next request
            if (currentStartTime > startTime) {
              await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
            }
            continue;
          }

          // Check if response has content before parsing JSON
          const responseText = await detailsResponse.text();
          if (!responseText || responseText.trim() === '') {
            console.log(`[backfill-activities] Empty response for activity details chunk, skipping...`);
            // Add delay before next request
            if (currentStartTime > startTime) {
              await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
            }
            continue;
          }

          let chunkActivityDetails: GarminActivityDetail[];
          try {
            chunkActivityDetails = JSON.parse(responseText);
          } catch (parseError) {
            console.error(`[backfill-activities] Failed to parse activity details JSON:`, parseError);
            console.error(`[backfill-activities] Response text:`, responseText);
            activityDetailsFailedChunks++;
            
            // Add delay before next request
            if (currentStartTime > startTime) {
              await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
            }
            continue;
          }
          console.log(`[backfill-activities] Fetched ${chunkActivityDetails.length} activity details`);
          
          if (chunkActivityDetails.length > 0) {
            // Transform and insert activity details
            const activityDetailsToInsert = chunkActivityDetails.map(detail => ({
              user_id: user.id,
              summary_id: detail.summaryId,
              activity_id: detail.activityId,
              activity_name: detail.activityName,
              samples: detail.samples,
              activity_summary: detail.activitySummary,
            }));

            // Use upsert to handle duplicates
            const { data: insertedDetailsData, error: insertDetailsError } = await supabase
              .from('garmin_activity_details')
              .upsert(activityDetailsToInsert, { 
                onConflict: 'user_id,summary_id',
                ignoreDuplicates: false 
              })
              .select('id');

            if (insertDetailsError) {
              console.error('[backfill-activities] Activity details insert error:', insertDetailsError);
              activityDetailsFailedChunks++;
            } else {
              const detailsCount = insertedDetailsData?.length || 0;
              savedActivityDetails += detailsCount;
              console.log(`[backfill-activities] Saved ${detailsCount} activity details`);
            }
          }

          // Add delay between requests
          if (currentStartTime > startTime) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
          }

        } catch (error) {
          console.error(`[backfill-activities] Error processing activity details:`, error);
          activityDetailsFailedChunks++;
          
          // Add delay before next request even on error
          if (currentStartTime > startTime) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
          }
        }
      }
    }
    
    console.log(`[backfill-activities] Activity details backfill completed: ${savedActivityDetails} details saved, ${activityDetailsFailedChunks} chunks failed`);

    // Update log status to completed
    if (logId) {
      await supabase
        .from('garmin_webhook_logs')
        .update({ 
          status: 'saved',
          payload: {
            ...logData?.payload,
            activitiesFound: activities.length,
            activitiesSaved: savedActivities,
            activityDetailsSaved: savedActivityDetails,
            chunksProcessed: processedChunks,
            chunksFailed: failedChunks,
            activityDetailsFailedChunks: activityDetailsFailedChunks,
            note: 'Activity details backfill requires PUSH Service configuration'
          }
        })
        .eq('id', logId);
    }

    return new Response(JSON.stringify({
      success: true,
      activities: savedActivities,
      activityDetails: savedActivityDetails,
      timeRange: requestBody.timeRange,
      startDate: new Date(startTime * 1000).toISOString(),
      endDate: new Date(endTime * 1000).toISOString(),
      activitiesFound: activities.length,
      activitiesSaved: savedActivities,
      activityDetailsSaved: savedActivityDetails,
      chunksProcessed: processedChunks,
      chunksFailed: failedChunks,
      activityDetailsFailedChunks: activityDetailsFailedChunks
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
