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
  calories?: number;
  distance?: number;
  sport?: string;
  'detailed-sport-info'?: string;
  'heart-rate'?: {
    average?: number;
    maximum?: number;
  };
  'start-time'?: string;
  'start-time-utc-offset'?: number;
}

function parseDurationToSeconds(duration: string): number | null {
  if (!duration) return null;
  
  // Handle different duration formats: PT1H30M45S, PT30M45S, PT45S
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (match) {
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseFloat(match[3] || '0');
    return hours * 3600 + minutes * 60 + seconds;
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
  
  // Try multiple possible endpoints for activity samples
  const possibleEndpoints = [
    `https://www.polaraccesslink.com/v3/exercises/${activityId}/samples`,
    `https://www.polaraccesslink.com/v3/exercises/${activityId}/tcx`,
    `https://www.polaraccesslink.com/v3/exercises/${activityId}/gpx`
  ];
  
  let samplesData = null;
  let samplesResponse = null;
  
  // Try each endpoint with retry logic
  for (const endpoint of possibleEndpoints) {
    console.log(`Trying endpoint: ${endpoint}`);
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        samplesResponse = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        });

        console.log(`Attempt ${attempt} for ${endpoint}: ${samplesResponse.status}`);
        
        if (samplesResponse.ok) {
          samplesData = await samplesResponse.json();
          console.log(`Successfully fetched data from ${endpoint}`);
          break;
        } else if (samplesResponse.status === 404) {
          console.log(`Endpoint ${endpoint} returned 404, trying next endpoint`);
          break; // Try next endpoint
        } else if (samplesResponse.status >= 500 && attempt < 3) {
          console.log(`Server error ${samplesResponse.status}, retrying in ${attempt * 1000}ms`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }
      } catch (error) {
        console.log(`Network error on attempt ${attempt} for ${endpoint}:`, error.message);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }
    
    if (samplesData) break; // Found data, stop trying other endpoints
  }

  if (!samplesData) {
    console.log(`No samples available for activity ${activityId} from any endpoint`);
    // Create a basic detail record even without samples
    const basicDetail = {
      activity_id: activityId,
      user_id: userId,
      polar_user_id: polarUserId,
      activity_type: activityData.sport || 'unknown',
      activity_name: `Polar Activity ${activityId}`,
      activity_summary: activityData,
      samples: null,
      duration_in_seconds: parseDurationToSeconds(activityData.duration),
      total_distance_in_meters: activityData.distance || null,
      heart_rate: activityData['heart-rate']?.average || null
    };
    
    const { error: insertError } = await supabase
      .from('polar_activity_details')
      .insert([basicDetail]);

    if (insertError) {
      console.error(`Error inserting basic detail for activity ${activityId}:`, insertError);
      throw insertError;
    }
    
    console.log(`Inserted basic detail record for activity ${activityId}`);
    return;
  }

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
          .maybeSingle();

        if (tokenError || !tokenData) {
          console.log(`No active token found for user ${activity.user_id}`);
          errors.push(`No active token for user ${activity.user_id}`);
          errorCount++;
          continue;
        }

        // Fetch activity data from Polar API with retry logic
        const activityUrl = `https://www.polaraccesslink.com/v3/exercises/${activity.activity_id}`;
        console.log(`Fetching activity from: ${activityUrl}`);
        
        let activityData = null;
        let lastError = null;
        
        // Retry logic for activity fetching
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const activityResponse = await fetch(activityUrl, {
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Accept': 'application/json'
              }
            });

            console.log(`Activity fetch attempt ${attempt}: ${activityResponse.status}`);
            
            if (activityResponse.ok) {
              activityData = await activityResponse.json();
              console.log(`Successfully fetched activity data for ${activity.activity_id}`);
              break;
            } else if (activityResponse.status === 404) {
              lastError = `Activity ${activity.activity_id} not found (404)`;
              console.log(lastError);
              break; // Don't retry on 404
            } else if (activityResponse.status === 401 || activityResponse.status === 403) {
              lastError = `Authentication failed for activity ${activity.activity_id} (${activityResponse.status})`;
              console.log(lastError);
              break; // Don't retry on auth errors
            } else if (activityResponse.status >= 500 && attempt < 3) {
              lastError = `Server error ${activityResponse.status} for activity ${activity.activity_id}`;
              console.log(`${lastError}, retrying in ${attempt * 1000}ms`);
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
              continue;
            } else {
              lastError = `HTTP ${activityResponse.status} for activity ${activity.activity_id}`;
              console.log(lastError);
              break;
            }
          } catch (error) {
            lastError = `Network error: ${error.message}`;
            console.log(`Network error on attempt ${attempt} for activity ${activity.activity_id}:`, error.message);
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }
          }
        }

        if (!activityData) {
          console.log(`Failed to fetch activity ${activity.activity_id}: ${lastError}`);
          errors.push(`Failed to fetch activity ${activity.activity_id}: ${lastError}`);
          errorCount++;
          continue;
        }

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