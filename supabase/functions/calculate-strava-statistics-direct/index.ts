import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'
import { corsHeaders } from '../_shared/cors.ts'

interface StravaActivity {
  user_id: string;
  strava_activity_id: number;
}

interface StravaSummary {
  distance: number;
  elapsed_time: number;
}

interface StravaDetail {
  heartrate?: number;
  velocity_smooth?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🚀 Starting direct Strava statistics calculation...');

    // Step 1: Get all unique Strava activities
    const { data: uniqueActivities, error: activitiesError } = await supabase
      .rpc('get_unique_strava_activities_with_details');

    if (activitiesError) {
      console.error('❌ Error fetching unique activities:', activitiesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch activities', details: activitiesError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${uniqueActivities?.length || 0} unique Strava activities to process`);

    let processedCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    // Step 2: Process each activity
    for (const activity of uniqueActivities as StravaActivity[]) {
      try {
        console.log(`\n🔄 Processing activity ${activity.strava_activity_id} for user ${activity.user_id}`);

        // Get summary data from strava_activities
        const { data: summaryData, error: summaryError } = await supabase
          .from('strava_activities')
          .select('distance, elapsed_time')
          .eq('user_id', activity.user_id)
          .eq('strava_activity_id', activity.strava_activity_id)
          .single();

        if (summaryError || !summaryData) {
          console.error(`❌ No summary data for activity ${activity.strava_activity_id}:`, summaryError);
          errorCount++;
          errors.push({ activity_id: activity.strava_activity_id, error: 'No summary data' });
          continue;
        }

        const summary = summaryData as StravaSummary;
        console.log(`📏 Summary: distance=${summary.distance}m, duration=${summary.elapsed_time}s`);

        // Get detail data from strava_activity_details
        const { data: detailData, error: detailError } = await supabase
          .from('strava_activity_details')
          .select('heartrate, velocity_smooth')
          .eq('user_id', activity.user_id)
          .eq('strava_activity_id', activity.strava_activity_id)
          .order('time_seconds', { ascending: true });

        if (detailError) {
          console.error(`❌ Error fetching details for activity ${activity.strava_activity_id}:`, detailError);
          errorCount++;
          errors.push({ activity_id: activity.strava_activity_id, error: 'Detail fetch error' });
          continue;
        }

        const details = detailData as StravaDetail[];
        console.log(`📋 Found ${details.length} detail records`);

        // Step 3: Calculate statistics
        const totalDistanceKm = summary.distance / 1000;
        const totalTimeMinutes = summary.elapsed_time / 60;
        const averagePaceMinKm = totalTimeMinutes / totalDistanceKm;

        // Heart rate statistics
        const heartRates = details
          .map(d => d.heartrate)
          .filter((hr): hr is number => hr != null && hr > 0);

        let averageHeartRate = null;
        let maxHeartRate = null;
        let heartRateStdDev = null;
        let heartRateCvPercent = null;

        if (heartRates.length > 0) {
          averageHeartRate = heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length;
          maxHeartRate = Math.max(...heartRates);
          
          if (heartRates.length > 1) {
            const variance = heartRates.reduce((sum, hr) => sum + Math.pow(hr - averageHeartRate!, 2), 0) / heartRates.length;
            heartRateStdDev = Math.sqrt(variance);
            heartRateCvPercent = (heartRateStdDev / averageHeartRate!) * 100;
          }
        }

        // Pace statistics (convert speed to pace)
        const speeds = details
          .map(d => d.velocity_smooth)
          .filter((speed): speed is number => speed != null && speed > 0);

        let paceStdDev = null;
        let paceCvPercent = null;

        if (speeds.length > 1) {
          const paces = speeds.map(speed => 1000 / (speed * 60)); // Convert to min/km
          const averagePace = paces.reduce((sum, pace) => sum + pace, 0) / paces.length;
          const paceVariance = paces.reduce((sum, pace) => sum + Math.pow(pace - averagePace, 2), 0) / paces.length;
          paceStdDev = Math.sqrt(paceVariance);
          paceCvPercent = (paceStdDev / averagePace) * 100;
        }

        // Step 4: Insert into statistics_metrics
        const metricsData = {
          user_id: activity.user_id,
          activity_id: activity.strava_activity_id.toString(),
          source_activity: 'strava',
          total_distance_km: Math.round(totalDistanceKm * 100) / 100,
          total_time_minutes: Math.round(totalTimeMinutes * 100) / 100,
          average_pace_min_km: Math.round(averagePaceMinKm * 100) / 100,
          average_heart_rate: averageHeartRate ? Math.round(averageHeartRate) : null,
          max_heart_rate: maxHeartRate,
          heart_rate_std_dev: heartRateStdDev ? Math.round(heartRateStdDev * 100) / 100 : null,
          heart_rate_cv_percent: heartRateCvPercent ? Math.round(heartRateCvPercent * 100) / 100 : null,
          pace_std_dev: paceStdDev ? Math.round(paceStdDev * 100) / 100 : null,
          pace_cv_percent: paceCvPercent ? Math.round(paceCvPercent * 100) / 100 : null,
          calculated_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('statistics_metrics')
          .upsert(metricsData, { 
            onConflict: 'user_id,activity_id,source_activity'
          });

        if (insertError) {
          console.error(`❌ Error inserting metrics for activity ${activity.strava_activity_id}:`, insertError);
          errorCount++;
          errors.push({ activity_id: activity.strava_activity_id, error: 'Insert error' });
        } else {
          console.log(`✅ Successfully processed activity ${activity.strava_activity_id}`);
          processedCount++;
        }

      } catch (error) {
        console.error(`❌ Unexpected error processing activity ${activity.strava_activity_id}:`, error);
        errorCount++;
        errors.push({ activity_id: activity.strava_activity_id, error: error.message });
      }
    }

    console.log(`\n🎯 Processing complete!`);
    console.log(`✅ Successfully processed: ${processedCount} activities`);
    console.log(`❌ Errors encountered: ${errorCount} activities`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errorCount,
        total: uniqueActivities.length,
        error_details: errors.length > 0 ? errors : undefined
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Fatal error in calculate-strava-statistics-direct:', error);
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