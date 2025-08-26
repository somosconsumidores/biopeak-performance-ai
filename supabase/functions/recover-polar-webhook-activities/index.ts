import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PolarActivity {
  id: string;
  'upload-time': string;
  'polar-user': string;
  duration: string;
  calories: number;
  distance: number;
  'heart-rate'?: {
    average?: number;
    maximum?: number;
  };
  'training-load'?: number;
  sport: string;
  'has-route': boolean;
  'club-id'?: number;
  'club-name'?: string;
  'detailed-sport-info': string;
  device?: string;
}

function parseDurationToSeconds(duration: string): number | null {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!match) return null;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseFloat(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

function extractPolarUserId(polarUserUrl: string): number | null {
  const match = polarUserUrl.match(/\/(\d+)$/);
  return match ? parseInt(match[1]) : null;
}

async function fetchAndStorePolarSamples(
  supabase: any,
  userId: string,
  activityId: string,
  polarUserId: number,
  accessToken: string,
  activityData: PolarActivity
) {
  try {
    console.log(`Fetching samples for activity ${activityId}`);
    
    const samplesResponse = await fetch(`https://www.polaraccesslink.com/v3/exercises/${activityId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!samplesResponse.ok) {
      console.error(`Failed to fetch samples for activity ${activityId}: ${samplesResponse.status}`);
      return;
    }

    const samplesData = await samplesResponse.json();
    console.log(`Fetched samples for activity ${activityId}:`, samplesData);

    // Process and store samples if available
    if (samplesData.samples && samplesData.samples.length > 0) {
      const sampleRows = [];
      let cumulativeDistance = 0;
      let cumulativeTime = 0;

      for (const sample of samplesData.samples) {
        // Update cumulative values
        if (sample['sample-type'] === 'DISTANCE') {
          cumulativeDistance += sample.data || 0;
        }
        if (sample['sample-type'] === 'TIME') {
          cumulativeTime += sample.data || 0;
        }

        sampleRows.push({
          user_id: userId,
          activity_id: activityId,
          polar_user_id: polarUserId,
          sample_timestamp: sample.datetime ? new Date(sample.datetime).getTime() : null,
          heart_rate: sample['sample-type'] === 'HEARTRATE' ? sample.data : null,
          speed_meters_per_second: sample['sample-type'] === 'SPEED' ? sample.data : null,
          latitude_in_degree: sample['sample-type'] === 'LATITUDE' ? sample.data : null,
          longitude_in_degree: sample['sample-type'] === 'LONGITUDE' ? sample.data : null,
          elevation_in_meters: sample['sample-type'] === 'ALTITUDE' ? sample.data : null,
          total_distance_in_meters: sample['sample-type'] === 'DISTANCE' ? cumulativeDistance : null,
          duration_in_seconds: sample['sample-type'] === 'TIME' ? cumulativeTime : null,
          power_in_watts: sample['sample-type'] === 'POWER' ? sample.data : null,
          cadence: sample['sample-type'] === 'CADENCE' ? sample.data : null,
          temperature_celsius: sample['sample-type'] === 'TEMPERATURE' ? sample.data : null,
          samples: samplesData.samples,
          activity_summary: samplesData,
          device_name: activityData.device || null,
          activity_type: activityData.sport || null,
          activity_name: `${activityData.sport} Activity` || null,
        });
      }

      // Insert samples in chunks
      const chunkSize = 100;
      for (let i = 0; i < sampleRows.length; i += chunkSize) {
        const chunk = sampleRows.slice(i, i + chunkSize);
        const { error: sampleError } = await supabase
          .from('polar_activity_details')
          .upsert(chunk, { 
            onConflict: 'user_id,activity_id,sample_timestamp',
            ignoreDuplicates: false 
          });

        if (sampleError) {
          console.error(`Error inserting sample chunk for activity ${activityId}:`, sampleError);
        } else {
          console.log(`Inserted ${chunk.length} samples for activity ${activityId}`);
        }
      }
    } else {
      // Insert a summary record even if no samples
      const { error: summaryError } = await supabase
        .from('polar_activity_details')
        .upsert({
          user_id: userId,
          activity_id: activityId,
          polar_user_id: polarUserId,
          activity_summary: samplesData,
          device_name: activityData.device || null,
          activity_type: activityData.sport || null,
          activity_name: `${activityData.sport} Activity` || null,
        }, { 
          onConflict: 'user_id,activity_id',
          ignoreDuplicates: false 
        });

      if (summaryError) {
        console.error(`Error inserting summary for activity ${activityId}:`, summaryError);
      }
    }
  } catch (error) {
    console.error(`Error processing samples for activity ${activityId}:`, error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting Polar webhook activity recovery...');

    // Get unprocessed exercise webhooks
    const { data: webhookLogs, error: webhookError } = await supabase
      .from('polar_webhook_logs')
      .select('*')
      .eq('webhook_type', 'EXERCISE')
      .eq('status', 'success')
      .not('payload', 'is', null);

    if (webhookError) {
      throw new Error(`Failed to fetch webhook logs: ${webhookError.message}`);
    }

    console.log(`Found ${webhookLogs?.length || 0} successful exercise webhooks`);

    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const webhook of webhookLogs || []) {
      try {
        const payload = webhook.payload;
        
        if (!payload?.url) {
          console.log(`Skipping webhook ${webhook.id} - no activity URL in payload`);
          continue;
        }

        // Extract activity ID from URL
        const activityIdMatch = payload.url.match(/\/exercises\/([^\/\?]+)/);
        if (!activityIdMatch) {
          console.log(`Skipping webhook ${webhook.id} - could not extract activity ID from URL: ${payload.url}`);
          continue;
        }

        const activityId = activityIdMatch[1];

        // Check if activity already exists
        const { data: existingActivity } = await supabase
          .from('polar_activities')
          .select('id')
          .eq('activity_id', activityId)
          .single();

        if (existingActivity) {
          console.log(`Activity ${activityId} already exists, skipping`);
          continue;
        }

        // Get user from polar_user_id in webhook
        const polarUserId = webhook.polar_user_id;
        if (!polarUserId) {
          console.log(`Skipping webhook ${webhook.id} - no polar_user_id`);
          continue;
        }

        // Get user_id and access_token from polar_tokens
        const { data: tokenData, error: tokenError } = await supabase
          .from('polar_tokens')
          .select('user_id, access_token')
          .eq('x_user_id', polarUserId)
          .eq('is_active', true)
          .single();

        if (tokenError || !tokenData) {
          console.log(`Skipping activity ${activityId} - no active token found for polar_user_id ${polarUserId}`);
          continue;
        }

        const { user_id: userId, access_token: accessToken } = tokenData;

        console.log(`Processing activity ${activityId} for user ${userId}`);

        // Fetch activity data from Polar API
        const activityResponse = await fetch(payload.url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!activityResponse.ok) {
          const errorMsg = `Failed to fetch activity ${activityId}: ${activityResponse.status}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          errorCount++;
          continue;
        }

        const activityData: PolarActivity = await activityResponse.json();
        console.log(`Fetched activity data for ${activityId}:`, activityData);

        // Process and store the activity
        const durationInSeconds = parseDurationToSeconds(activityData.duration);
        const polarUserIdFromUrl = extractPolarUserId(activityData['polar-user']);

        const activityRecord = {
          user_id: userId,
          activity_id: activityData.id,
          upload_time: new Date(activityData['upload-time']),
          polar_user_id: polarUserIdFromUrl,
          duration: activityData.duration,
          calories: activityData.calories,
          distance: activityData.distance,
          start_time: payload.timestamp ? new Date(payload.timestamp) : new Date(activityData['upload-time']),
          activity_type: activityData.sport,
          sport: activityData.sport,
          has_route: activityData['has-route'],
          training_load: activityData['training-load'],
          club_id: activityData['club-id'],
          club_name: activityData['club-name'],
          detailed_sport_info: activityData['detailed-sport-info'],
          device: activityData.device,
          polar_user: activityData['polar-user'],
          transaction_id: payload.transaction_id,
        };

        // Insert activity
        const { error: activityError } = await supabase
          .from('polar_activities')
          .upsert(activityRecord, { 
            onConflict: 'activity_id,user_id',
            ignoreDuplicates: false 
          });

        if (activityError) {
          const errorMsg = `Error inserting activity ${activityId}: ${activityError.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          errorCount++;
          continue;
        }

        // Fetch and store detailed samples
        await fetchAndStorePolarSamples(
          supabase,
          userId,
          activityData.id,
          polarUserIdFromUrl || polarUserId,
          accessToken,
          activityData
        );

        // Update webhook log status
        await supabase
          .from('polar_webhook_logs')
          .update({ 
            status: 'processed',
            updated_at: new Date().toISOString(),
            user_id: userId
          })
          .eq('id', webhook.id);

        processedCount++;
        console.log(`Successfully processed activity ${activityId}`);

      } catch (error) {
        const errorMsg = `Error processing webhook ${webhook.id}: ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
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

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Recovery function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});