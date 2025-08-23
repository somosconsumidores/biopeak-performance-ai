import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const requestBody = await req.json();
    const { activity_id, user_id, access_token, internal_call } = requestBody;

    let currentUserId;
    let stravaAccessToken;

    // Handle internal calls from other edge functions
    if (internal_call && user_id && access_token) {
      currentUserId = user_id;
      stravaAccessToken = access_token;
      console.log('Processing internal call for user:', currentUserId);
    } else {
      // Handle regular authenticated calls
      const authorization = req.headers.get('Authorization');
      if (!authorization) {
        throw new Error('No authorization header');
      }

      // Get user from JWT
      const { data: { user }, error: userError } = await supabase.auth.getUser(
        authorization.replace('Bearer ', '')
      );
      
      if (userError || !user) {
        throw new Error('Invalid user token');
      }

      currentUserId = user.id;

      // Get user's Strava token
      const { data: stravaTokens, error: tokenError } = await supabase
        .from('strava_tokens')
        .select('access_token')
        .eq('user_id', currentUserId)
        .single();

      if (tokenError || !stravaTokens) {
        throw new Error('No valid Strava token found');
      }

      stravaAccessToken = stravaTokens.access_token;
    }
    
    if (!activity_id) {
      throw new Error('activity_id is required');
    }

    console.log(`Fetching streams for activity ${activity_id} for user ${currentUserId}`);

    // Fetch activity streams from Strava API
    const streamKeys = [
      'latlng',
      'heartrate',
      'velocity_smooth',
      'cadence',
      'watts',
      'distance',
      'time',
      'grade_smooth',
      'temp',
      'moving'
    ].join(',');

    const stravaResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${activity_id}/streams?keys=${streamKeys}&key_by_type=true`,
      {
        headers: {
          'Authorization': `Bearer ${stravaAccessToken}`,
        },
      }
    );

    if (!stravaResponse.ok) {
      const errorText = await stravaResponse.text();
      console.error('Strava API error:', stravaResponse.status, errorText);
      throw new Error(`Strava API error: ${stravaResponse.status}`);
    }

    const streams = await stravaResponse.json();
    console.log('Successfully fetched streams from Strava:', Object.keys(streams));

    // Transform streams into individual time-point records
    const timePoints = [];
    
    // Get the time stream as the base for iteration
    const timeData = streams.time?.data || [];
    const latlngData = streams.latlng?.data || [];
    const heartrateData = streams.heartrate?.data || [];
    const velocityData = streams.velocity_smooth?.data || [];
    const cadenceData = streams.cadence?.data || [];
    const wattsData = streams.watts?.data || [];
    const distanceData = streams.distance?.data || [];
    const gradeData = streams.grade_smooth?.data || [];
    const tempData = streams.temp?.data || [];
    const movingData = streams.moving?.data || [];

    console.log(`Processing ${timeData.length} time points for activity ${activity_id}`);

    // Create individual records for each time point
    for (let i = 0; i < timeData.length; i++) {
      const timePoint = {
        user_id: currentUserId,
        strava_activity_id: parseInt(activity_id),
        time_index: i,
        time_seconds: timeData[i] || null,
        latitude: latlngData[i] ? latlngData[i][0] : null,
        longitude: latlngData[i] ? latlngData[i][1] : null,
        heartrate: heartrateData[i] || null,
        velocity_smooth: velocityData[i] || null,
        cadence: cadenceData[i] || null,
        watts: wattsData[i] || null,
        distance: distanceData[i] || null,
        grade_smooth: gradeData[i] || null,
        temp: tempData[i] || null,
        moving: movingData[i] || null,
      };
      timePoints.push(timePoint);
    }

    // Delete existing records for this activity first
    const { error: deleteError } = await supabase
      .from('strava_activity_details')
      .delete()
      .eq('user_id', currentUserId)
      .eq('strava_activity_id', parseInt(activity_id));

    if (deleteError) {
      console.error('Error deleting existing records:', deleteError);
      throw deleteError;
    }

    // Insert time points in batches to avoid timeouts
    const BATCH_SIZE = 500;
    let insertedCount = 0;

    for (let i = 0; i < timePoints.length; i += BATCH_SIZE) {
      const batch = timePoints.slice(i, i + BATCH_SIZE);
      console.log(`Inserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(timePoints.length / BATCH_SIZE)} with ${batch.length} records`);

      const { error: batchError } = await supabase
        .from('strava_activity_details')
        .insert(batch);

      if (batchError) {
        console.error('Batch insert error:', batchError);
        const isTimeout = batchError.code === '57014' || (batchError.message && batchError.message.includes('timeout'));
        if (isTimeout && batch.length > 1) {
          const retrySize = Math.max(100, Math.floor(BATCH_SIZE / 2));
          console.log(`Retrying batch with smaller sub-batches of ${retrySize}`);
          for (let r = 0; r < batch.length; r += retrySize) {
            const sub = batch.slice(r, r + retrySize);
            const { error: subErr } = await supabase
              .from('strava_activity_details')
              .insert(sub);
            if (subErr) {
              console.error('Sub-batch insert error:', subErr);
              throw subErr;
            }
            insertedCount += sub.length;
          }
        } else {
          throw batchError;
        }
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`Successfully saved ${insertedCount} time points to database`);
    
    console.log('Successfully saved streams to database');
    
    // Trigger activity chart data calculation
    try {
      await supabase.functions.invoke('calculate-activity-chart-data', {
        body: {
          activity_id: String(activity_id),
          user_id: currentUserId,
          activity_source: 'strava',
          internal_call: true,
        },
      });
      console.log('Activity chart data calculated for Strava activity:', activity_id);
    } catch (e) {
      console.error('Failed to calculate activity chart data (Strava):', e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { inserted: insertedCount },
        message: 'Activity streams fetched and saved successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in strava-activity-streams function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});