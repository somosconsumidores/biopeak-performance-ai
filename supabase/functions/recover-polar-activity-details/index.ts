import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PolarActivity {
  id: string;
  'upload-time': string;
  'polar-user': string;
  duration: string;
  calories: number;
  distance: number;
  'heart-rate': {
    average: number;
    maximum: number;
  };
}

function parseDurationToSeconds(duration: string): number | null {
  const match = duration.match(/PT(\d+(?:\.\d+)?)S/);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

function extractPolarUserId(polarUserUrl: string): number | null {
  const match = polarUserUrl.match(/\/users\/(\d+)$/);
  return match ? parseInt(match[1]) : null;
}

async function fetchAndStorePolarSamples(
  activityId: string,
  accessToken: string,
  userId: string,
  polarUserId: number,
  supabase: any,
  activityData: PolarActivity
) {
  console.log(`Fetching samples for activity ${activityId}`);
  
  const samplesUrl = `https://www.polaraccesslink.com/v3/exercises/${activityId}/samples`;
  
  const samplesResponse = await fetch(samplesUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!samplesResponse.ok) {
    console.log(`No samples available for activity ${activityId}: ${samplesResponse.status}`);
    return;
  }

  const samplesData = await samplesResponse.json();
  console.log(`Got samples data for activity ${activityId}:`, JSON.stringify(samplesData).substring(0, 200));

  if (!samplesData.samples || samplesData.samples.length === 0) {
    console.log(`No samples found for activity ${activityId}`);
    return;
  }

  // Process samples
  const processedSamples = [];
  let cumulativeDistance = 0;
  let cumulativeTime = 0;

  for (const sample of samplesData.samples) {
    if (sample['heart-rate'] && sample.speed) {
      cumulativeTime += 1; // Each sample represents 1 second
      cumulativeDistance += sample.speed; // Speed is in m/s, so 1 second = speed meters

      processedSamples.push({
        activity_id: activityId,
        user_id: userId,
        polar_user_id: polarUserId,
        sample_timestamp: sample.datetime ? new Date(sample.datetime).getTime() / 1000 : null,
        heart_rate: sample['heart-rate'],
        speed_meters_per_second: sample.speed,
        power_in_watts: sample.power || null,
        cadence: sample.cadence || null,
        longitude_in_degree: sample.longitude || null,
        latitude_in_degree: sample.latitude || null,
        elevation_in_meters: sample.altitude || null,
        total_distance_in_meters: cumulativeDistance,
        duration_in_seconds: cumulativeTime,
        activity_type: 'running',
        activity_name: `Polar Activity ${activityId}`,
        activity_summary: activityData,
        samples: samplesData.samples
      });
    }
  }

  if (processedSamples.length === 0) {
    console.log(`No valid samples to insert for activity ${activityId}`);
    return;
  }

  // Insert samples in chunks
  const chunkSize = 100;
  for (let i = 0; i < processedSamples.length; i += chunkSize) {
    const chunk = processedSamples.slice(i, i + chunkSize);
    
    const { error: insertError } = await supabase
      .from('polar_activity_details')
      .insert(chunk);

    if (insertError) {
      console.error(`Error inserting sample chunk for activity ${activityId}:`, insertError);
      throw insertError;
    }
  }

  console.log(`Successfully inserted ${processedSamples.length} samples for activity ${activityId}`);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Polar activity details recovery...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find activities in polar_activities that don't have details using LEFT JOIN
    const { data: activitiesWithoutDetails, error: queryError } = await supabase
      .rpc('get_polar_activities_without_details');

    if (queryError) {
      console.error('Error finding activities without details:', queryError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to query activities',
          details: queryError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found ${activitiesWithoutDetails?.length || 0} activities without details`);

    if (!activitiesWithoutDetails || activitiesWithoutDetails.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No activities without details found',
          processed_count: 0,
          error_count: 0,
          errors: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each activity
    for (const activity of activitiesWithoutDetails) {
      try {
        console.log(`Processing activity ${activity.activity_id} for user ${activity.user_id}`);
        
        // Get user's active Polar token
        const { data: tokenData, error: tokenError } = await supabase
          .from('polar_tokens')
          .select('access_token')
          .eq('user_id', activity.user_id)
          .eq('is_active', true)
          .limit(1)
          .single();

        if (tokenError || !tokenData) {
          console.log(`No active token found for user ${activity.user_id}`);
          errors.push(`No active token for user ${activity.user_id}`);
          errorCount++;
          continue;
        }

        // Fetch activity data from Polar API
        const activityUrl = `https://www.polaraccesslink.com/v3/exercises/${activity.activity_id}`;
        console.log(`Fetching activity from: ${activityUrl}`);
        
        const activityResponse = await fetch(activityUrl, {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        });

        if (!activityResponse.ok) {
          console.log(`Failed to fetch activity ${activity.activity_id}: ${activityResponse.status}`);
          errors.push(`Failed to fetch activity ${activity.activity_id}: ${activityResponse.status}`);
          errorCount++;
          continue;
        }

        const activityData = await activityResponse.json();
        console.log(`Fetched activity data for ${activity.activity_id}`);

        // Fetch and store activity samples
        await fetchAndStorePolarSamples(
          activity.activity_id,
          tokenData.access_token,
          activity.user_id,
          activity.polar_user_id,
          supabase,
          activityData
        );

        processedCount++;
        console.log(`Successfully processed activity ${activity.activity_id}`);

      } catch (error) {
        console.error(`Error processing activity ${activity.activity_id}:`, error);
        errors.push(`Error processing activity ${activity.activity_id}: ${error.message}`);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Recovery completed: ${processedCount} activities processed, ${errorCount} errors`,
      processed_count: processedCount,
      error_count: errorCount,
      errors: errors
    };

    console.log('Recovery completed:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Recovery function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
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