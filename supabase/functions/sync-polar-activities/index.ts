import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PolarActivity {
  id: string;
  'upload-time': string;
  'polar-user': string;
  'transaction-id': number;
  device?: string;
  'device-id'?: string;
  'start-time'?: string;
  'start-time-utc-offset'?: number;
  duration?: string;
  calories?: number;
  distance?: number;
  'heart-rate'?: {
    average: number;
    maximum: number;
  };
  'training-load'?: number;
  sport?: string;
  'has-route'?: boolean;
  'club-id'?: number;
  'club-name'?: string;
  'detailed-sport-info'?: string;
}

// Helper function to convert ISO 8601 duration to seconds
function parseDurationToSeconds(duration: string): number | null {
  if (!duration) return null;
  
  // Parse ISO 8601 duration like "PT54.649S" or "PT1H23M45.5S"
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/;
  const matches = duration.match(regex);
  
  if (!matches) return null;
  
  const hours = parseInt(matches[1] || '0', 10);
  const minutes = parseInt(matches[2] || '0', 10);
  const seconds = parseFloat(matches[3] || '0');
  
  return Math.round(hours * 3600 + minutes * 60 + seconds);
}

// Helper function to extract numeric user ID from Polar user URL
function extractPolarUserId(polarUserUrl: string): number | null {
  if (!polarUserUrl) return null;
  
  // Extract ID from URL like "https://www.polaraccesslink.com/v3/users/63167832"
  const match = polarUserUrl.match(/\/users\/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

// Helper function to fetch and store detailed samples
async function fetchAndStorePolarSamples(
  activityId: string,
  activityUrl: string,
  userId: string,
  polarUserId: number | null,
  accessToken: string,
  supabase: any
) {
  try {
    console.log(`[sync-polar-activities] Fetching samples for activity ${activityId}`);
    
    // Fetch the detailed activity data which may contain samples links
    const activityResponse = await fetch(activityUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!activityResponse.ok) {
      console.error(`[sync-polar-activities] Failed to fetch activity details for samples: ${activityResponse.status}`);
      return;
    }

    const activityData = await activityResponse.json();
    
    // Check if samples are available
    if (!activityData.samples || !Array.isArray(activityData.samples)) {
      console.log(`[sync-polar-activities] No samples available for activity ${activityId}`);
      return;
    }

    const samples = [];
    let cumulativeDistance = 0;
    let cumulativeTime = 0;
    
    // Process each sample URL
    for (const sampleUrl of activityData.samples) {
      try {
        const sampleResponse = await fetch(sampleUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          }
        });

        if (!sampleResponse.ok) {
          console.error(`[sync-polar-activities] Failed to fetch sample from ${sampleUrl}: ${sampleResponse.status}`);
          continue;
        }

        const sampleData = await sampleResponse.json();
        console.log(`[sync-polar-activities] Fetched sample data for activity ${activityId}`);
        
        // Process sample data based on type
        if (sampleData.data && Array.isArray(sampleData.data)) {
          for (const dataPoint of sampleData.data) {
            // Calculate cumulative values based on recording rate
            const recordingRate = dataPoint['recording-rate'] || 1;
            if (dataPoint.speed) {
              cumulativeDistance += (dataPoint.speed * recordingRate);
            }
            cumulativeTime += recordingRate;

            const sample = {
              user_id: userId,
              activity_id: activityId,
              polar_user_id: polarUserId,
              sample_timestamp: dataPoint.timestamp || null,
              heart_rate: dataPoint['heart-rate'] || null,
              speed_meters_per_second: dataPoint.speed || null,
              latitude_in_degree: dataPoint.latitude || null,
              longitude_in_degree: dataPoint.longitude || null,
              elevation_in_meters: dataPoint.altitude || null,
              total_distance_in_meters: cumulativeDistance,
              duration_in_seconds: cumulativeTime,
              power_in_watts: dataPoint.power || null,
              cadence: dataPoint.cadence || null,
              temperature_celsius: dataPoint.temperature || null,
              samples: sampleData,
              activity_summary: activityData,
              device_name: activityData.device || null,
              activity_type: activityData['detailed-sport-info'] || activityData.sport || null,
              activity_name: `${activityData.sport || 'Activity'} - ${new Date(activityData['start-time'] || Date.now()).toLocaleDateString()}`,
            };

            samples.push(sample);
          }
        }
      } catch (sampleError) {
        console.error(`[sync-polar-activities] Error processing sample from ${sampleUrl}:`, sampleError);
        continue;
      }
    }

    // Batch insert samples if any were processed
    if (samples.length > 0) {
      console.log(`[sync-polar-activities] Inserting ${samples.length} samples for activity ${activityId}`);
      
      // Insert in chunks to avoid payload size limits
      const chunkSize = 1000;
      for (let i = 0; i < samples.length; i += chunkSize) {
        const chunk = samples.slice(i, i + chunkSize);
        const { error: insertError } = await supabase
          .from('polar_activity_details')
          .insert(chunk);

        if (insertError) {
          console.error(`[sync-polar-activities] Error inserting samples chunk for activity ${activityId}:`, insertError);
        } else {
          console.log(`[sync-polar-activities] Successfully inserted ${chunk.length} samples for activity ${activityId}`);
        }
      }
    } else {
      console.log(`[sync-polar-activities] No valid samples found for activity ${activityId}`);
    }

  } catch (error) {
    console.error(`[sync-polar-activities] Error fetching samples for activity ${activityId}:`, error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, polar_user_id, access_token, webhook_payload } = await req.json();

    if (!user_id || !access_token) {
      throw new Error('User ID and access token are required');
    }

    // Use polar_user_id for API calls, fallback to user_id if not provided
    const apiUserId = polar_user_id || user_id;
    
    console.log('[sync-polar-activities] Starting sync for user:', user_id);
    console.log('[sync-polar-activities] Using Polar user ID for API calls:', apiUserId);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Create transaction to get available activities
    const transactionResponse = await fetch(`https://www.polaraccesslink.com/v3/users/${apiUserId}/exercise-transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!transactionResponse.ok) {
      if (transactionResponse.status === 204) {
        console.log('[sync-polar-activities] No activities to sync (204 response)');
        return new Response(
          JSON.stringify({
            success: true,
            synced_activities: 0,
            total_available: 0,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
      throw new Error(`Failed to create transaction: ${transactionResponse.statusText}`);
    }

    const transactionData = await transactionResponse.json();
    const transactionId = transactionData['transaction-id'];
    console.log('[sync-polar-activities] Created transaction:', transactionId);

    // Get activities from transaction
    const activitiesResponse = await fetch(`https://www.polaraccesslink.com/v3/users/${apiUserId}/exercise-transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!activitiesResponse.ok) {
      throw new Error(`Failed to fetch activities: ${activitiesResponse.statusText}`);
    }

    const activitiesData = await activitiesResponse.json();
    const activities: string[] = activitiesData['exercises'] || [];

    console.log('[sync-polar-activities] Found', activities.length, 'available activities');

    let syncedCount = 0;

    // Process each activity
    for (const activityUrl of activities) {
      try {
        // Fetch detailed activity data
        const activityResponse = await fetch(activityUrl, {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Accept': 'application/json',
          },
        });

        if (!activityResponse.ok) {
          console.error('[sync-polar-activities] Failed to fetch activity:', activityUrl);
          continue;
        }

        const activityData: PolarActivity = await activityResponse.json();
        
        // Log the actual structure to debug
        console.log('[sync-polar-activities] Raw activity data:', JSON.stringify(activityData, null, 2));
        
        // Check if activity already exists
        const { data: existingActivity } = await supabase
          .from('polar_activities')
          .select('id')
          .eq('activity_id', activityData.id)
          .eq('user_id', user_id)
          .single();

        if (existingActivity) {
          console.log('[sync-polar-activities] Activity already exists:', activityData.id);
          continue;
        }

        // Convert duration from ISO 8601 to seconds
        const durationInSeconds = parseDurationToSeconds(activityData.duration);
        
        // Extract numeric Polar user ID from URL
        const polarUserId = extractPolarUserId(activityData['polar-user']);
        
        // Convert start time to timestamp
        const startTime = activityData['start-time'] ? new Date(activityData['start-time']).toISOString() : null;
        const uploadTime = activityData['upload-time'] ? new Date(activityData['upload-time']).toISOString() : null;
        
        console.log('[sync-polar-activities] Processed data:', {
          duration_original: activityData.duration,
          duration_seconds: durationInSeconds,
          polar_user_original: activityData['polar-user'],
          polar_user_id: polarUserId,
          start_time: startTime,
          upload_time: uploadTime
        });

        // Insert new activity with corrected field mapping
        const { error: insertError } = await supabase
          .from('polar_activities')
          .insert({
            user_id: user_id,
            activity_id: activityData.id,
            upload_time: uploadTime,
            polar_user: activityData['polar-user'],
            transaction_id: activityData['transaction-id'],
            start_time: startTime,
            start_time_utc_offset: activityData['start-time-utc-offset'],
            duration: durationInSeconds ? durationInSeconds.toString() : null,
            calories: activityData.calories,
            distance: activityData.distance,
            average_heart_rate_bpm: activityData['heart-rate']?.average,
            maximum_heart_rate_bpm: activityData['heart-rate']?.maximum,
            training_load: activityData['training-load'],
            sport: activityData.sport,
            has_route: activityData['has-route'] || false,
            club_id: activityData['club-id'],
            club_name: activityData['club-name'],
            detailed_sport_info: activityData['detailed-sport-info'],
            device: activityData.device,
            device_id: activityData['device-id'],
            polar_user_id: polarUserId,
          });

        if (insertError) {
          console.error('[sync-polar-activities] Failed to insert activity:', insertError);
        } else {
          syncedCount++;
          console.log('[sync-polar-activities] Synced activity:', activityData.id);
          
          // Try to fetch and store detailed samples
          try {
            await fetchAndStorePolarSamples(activityData.id, activityUrl, user_id, polarUserId, access_token, supabase);
          } catch (sampleError) {
            console.error(`[sync-polar-activities] Failed to fetch samples for activity ${activityData.id}:`, sampleError);
            // Don't fail the whole sync if samples fail
          }
        }

      } catch (activityError) {
        console.error('[sync-polar-activities] Error processing activity:', activityError);
      }
    }

    // Commit transaction to confirm processing
    const commitResponse = await fetch(`https://www.polaraccesslink.com/v3/users/${apiUserId}/exercise-transactions/${transactionId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!commitResponse.ok) {
      console.error('[sync-polar-activities] Failed to commit transaction:', commitResponse.statusText);
    }

    console.log('[sync-polar-activities] Sync completed. Synced', syncedCount, 'activities');

    return new Response(
      JSON.stringify({
        success: true,
        synced_activities: syncedCount,
        total_available: activities.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[sync-polar-activities] Error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});