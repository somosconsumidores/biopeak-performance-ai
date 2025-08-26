import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[recover-specific-webhook] Starting recovery for webhook 8018e2af-707a-466a-b9d7-c83d2c262df4');

    // Get the specific webhook data
    const { data: webhookData, error: webhookError } = await supabaseClient
      .from('garmin_webhook_logs')
      .select('*')
      .eq('id', '8018e2af-707a-466a-b9d7-c83d2c262df4')
      .single();

    if (webhookError || !webhookData) {
      console.error('[recover-specific-webhook] Webhook not found:', webhookError);
      return new Response(
        JSON.stringify({ error: 'Webhook not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    console.log('[recover-specific-webhook] Found webhook data:', webhookData);

    // Extract activity details from the payload
    const payload = webhookData.payload;
    const summaryId = '19838314185-detail';
    const activityId = '19838314185';
    const userId = 'fa155754-46c5-4f12-99e2-54a9673ff74f';

    console.log(`[recover-specific-webhook] Processing activity ${activityId} with summary ${summaryId} for user ${userId}`);

    // Check if the activity details already exist
    const { data: existingDetails } = await supabaseClient
      .from('garmin_activity_details')
      .select('id')
      .eq('user_id', userId)
      .eq('summary_id', summaryId)
      .limit(1);

    if (existingDetails && existingDetails.length > 0) {
      console.log('[recover-specific-webhook] Activity details already exist, no need to recover');
      return new Response(
        JSON.stringify({ 
          message: 'Activity details already exist',
          summary_id: summaryId,
          existing_records: existingDetails.length
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Process the activity details manually
    const activitySummary = payload.summary || {};
    const samples = payload.samples || [];
    const activityName = activitySummary.activityName || 'Recovered Activity';

    console.log(`[recover-specific-webhook] Processing ${samples.length} samples for activity ${activityId}`);

    const BATCH_SIZE = 500;
    let totalProcessed = 0;
    const errors: string[] = [];

    // Process samples in batches
    for (let i = 0; i < samples.length; i += BATCH_SIZE) {
      const batch = samples.slice(i, i + BATCH_SIZE);
      console.log(`[recover-specific-webhook] Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(samples.length/BATCH_SIZE)} (${batch.length} samples)`);
      
      const batchData = batch.map(sample => {
        const sampleTimestamp = sample.startTimeInSeconds || activitySummary.startTimeInSeconds || null;
        
        return {
          user_id: userId,
          activity_id: activityId,
          summary_id: summaryId,
          activity_name: activityName,
          upload_time_in_seconds: activitySummary.uploadTimeInSeconds || null,
          start_time_in_seconds: sampleTimestamp,
          duration_in_seconds: activitySummary.durationInSeconds || null,
          activity_type: activitySummary.activityType || null,
          device_name: activitySummary.deviceName || null,
          sample_timestamp: sampleTimestamp,
          samples: sample,
          activity_summary: activitySummary,
          heart_rate: sample.heartRate || null,
          latitude_in_degree: sample.latitudeInDegree || null,
          longitude_in_degree: sample.longitudeInDegree || null,
          elevation_in_meters: sample.elevationInMeters || null,
          speed_meters_per_second: sample.speedMetersPerSecond || null,
          power_in_watts: sample.powerInWatts || null,
          total_distance_in_meters: sample.totalDistanceInMeters || null,
          steps_per_minute: sample.stepsPerMinute || null,
          clock_duration_in_seconds: sample.clockDurationInSeconds || null,
          moving_duration_in_seconds: sample.movingDurationInSeconds || null,
          timer_duration_in_seconds: sample.timerDurationInSeconds || null,
          updated_at: new Date().toISOString()
        };
      });

      try {
        const { error: batchError } = await supabaseClient
          .from('garmin_activity_details')
          .upsert(batchData, {
            onConflict: 'user_id,summary_id,sample_timestamp'
          });

        if (batchError) {
          console.error(`[recover-specific-webhook] Error upserting batch:`, batchError);
          errors.push(`Failed to store batch: ${batchError.message}`);
        } else {
          console.log(`[recover-specific-webhook] Successfully processed batch of ${batch.length} samples`);
          totalProcessed += batch.length;
        }
      } catch (batchErr) {
        console.error(`[recover-specific-webhook] Unexpected error processing batch:`, batchErr);
        errors.push(`Unexpected error processing batch`);
      }
    }

    // Also add a summary record if no samples were processed
    if (samples.length === 0) {
      const defaultTimestamp = activitySummary.startTimeInSeconds || null;
      
      const { error: summaryError } = await supabaseClient
        .from('garmin_activity_details')
        .upsert({
          user_id: userId,
          activity_id: activityId,
          summary_id: summaryId,
          activity_name: activityName,
          upload_time_in_seconds: activitySummary.uploadTimeInSeconds || null,
          start_time_in_seconds: defaultTimestamp,
          duration_in_seconds: activitySummary.durationInSeconds || null,
          activity_type: activitySummary.activityType || null,
          device_name: activitySummary.deviceName || null,
          sample_timestamp: defaultTimestamp,
          samples: null,
          activity_summary: activitySummary,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,summary_id,sample_timestamp'
        });

      if (summaryError) {
        console.error(`[recover-specific-webhook] Error upserting activity summary:`, summaryError);
        errors.push(`Failed to store activity summary: ${summaryError.message}`);
      } else {
        totalProcessed = 1;
      }
    }

    const result = {
      message: `Successfully recovered activity details for webhook ${webhookData.id}`,
      webhook_id: webhookData.id,
      user_id: userId,
      activity_id: activityId,
      summary_id: summaryId,
      samples_processed: totalProcessed,
      total_samples: samples.length,
      errors: errors.length > 0 ? errors : undefined,
      recovery_completed_at: new Date().toISOString()
    };

    console.log('[recover-specific-webhook] Recovery completed:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[recover-specific-webhook] Unexpected error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});