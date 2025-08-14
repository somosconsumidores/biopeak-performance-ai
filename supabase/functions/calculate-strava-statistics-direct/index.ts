import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'
import { corsHeaders } from '../_shared/cors.ts'

interface GarminActivity {
  user_id: string;
  activity_id: string;
}

interface GarminSummary {
  distance_in_meters: number;
  duration_in_seconds: number;
}

interface GarminDetail {
  heart_rate?: number;
  speed_meters_per_second?: number;
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

    console.log('🚀 Starting direct Garmin statistics calculation...');

    // Step 1: Get all unique Garmin activities that have details
    // First get activity IDs that have detail records
    const { data: activityIdsWithDetails, error: detailsError } = await supabase
      .from('garmin_activity_details')
      .select('activity_id, user_id')
      .not('activity_id', 'is', null);

    if (detailsError) {
      console.error('❌ Error fetching activity details:', detailsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch activity details', details: detailsError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique combinations
    const uniqueActivityIds = Array.from(
      new Set(activityIdsWithDetails?.map(item => `${item.user_id}:${item.activity_id}`) || [])
    ).map(combined => {
      const [user_id, activity_id] = combined.split(':');
      return { user_id, activity_id };
    });

    // Now get the activity summary data for these activities
    const { data: uniqueActivities, error: activitiesError } = await supabase
      .from('garmin_activities')
      .select('user_id, activity_id')
      .not('distance_in_meters', 'is', null)
      .not('duration_in_seconds', 'is', null)
      .in('activity_id', uniqueActivityIds.map(item => item.activity_id));

    if (activitiesError) {
      console.error('❌ Error fetching unique activities:', activitiesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch activities', details: activitiesError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${uniqueActivities?.length || 0} unique Garmin activities to process`);

    let processedCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    // Step 2: Process each activity
    for (const activity of uniqueActivities as GarminActivity[]) {
      try {
        console.log(`\n🔄 Processing activity ${activity.activity_id} for user ${activity.user_id}`);

        // Get summary data from garmin_activities
        const { data: summaryData, error: summaryError } = await supabase
          .from('garmin_activities')
          .select('distance_in_meters, duration_in_seconds')
          .eq('user_id', activity.user_id)
          .eq('activity_id', activity.activity_id)
          .single();

        if (summaryError || !summaryData) {
          console.error(`❌ No summary data for activity ${activity.activity_id}:`, summaryError);
          errorCount++;
          errors.push({ activity_id: activity.activity_id, error: 'No summary data' });
          continue;
        }

        const summary = summaryData as GarminSummary;
        console.log(`📏 Summary: distance=${summary.distance_in_meters}m, duration=${summary.duration_in_seconds}s`);

        // Get detail data from garmin_activity_details
        const { data: detailData, error: detailError } = await supabase
          .from('garmin_activity_details')
          .select('heart_rate, speed_meters_per_second')
          .eq('user_id', activity.user_id)
          .eq('activity_id', activity.activity_id)
          .order('sample_timestamp', { ascending: true });

        if (detailError) {
          console.error(`❌ Error fetching details for activity ${activity.activity_id}:`, detailError);
          errorCount++;
          errors.push({ activity_id: activity.activity_id, error: 'Detail fetch error' });
          continue;
        }

        const details = detailData as GarminDetail[];
        console.log(`📋 Found ${details.length} detail records`);

        // Step 3: Calculate statistics
        const totalDistanceKm = summary.distance_in_meters / 1000;
        const totalTimeMinutes = summary.duration_in_seconds / 60;
        const averagePaceMinKm = totalTimeMinutes / totalDistanceKm;

        // Heart rate statistics
        const heartRates = details
          .map(d => d.heart_rate)
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
          .map(d => d.speed_meters_per_second)
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
          activity_id: activity.activity_id,
          source_activity: 'garmin',
          total_distance_km: Math.round(totalDistanceKm * 100) / 100,
          total_time_minutes: Math.round(totalTimeMinutes * 100) / 100,
          average_pace_min_km: Math.round(averagePaceMinKm * 100) / 100,
          average_heart_rate: averageHeartRate ? Math.round(averageHeartRate) : null,
          max_heart_rate: maxHeartRate,
          heart_rate_std_dev: heartRateStdDev ? Math.round(heartRateStdDev * 100) / 100 : null,
          heart_rate_cv_percent: heartRateCvPercent ? Math.round(heartRateCvPercent * 100) / 100 : null,
          pace_std_dev: paceStdDev ? Math.round(paceStdDev * 100) / 100 : null,
          pace_cv_percent: paceCvPercent ? Math.round(paceCvPercent * 100) / 100 : null
        };

        const { error: insertError } = await supabase
          .from('statistics_metrics')
          .upsert(metricsData, { 
            onConflict: 'user_id,activity_id,source_activity'
          });

        if (insertError) {
          console.error(`❌ Error inserting metrics for activity ${activity.activity_id}:`, insertError);
          errorCount++;
          errors.push({ activity_id: activity.activity_id, error: 'Insert error' });
        } else {
          console.log(`✅ Successfully processed activity ${activity.activity_id}`);
          processedCount++;
        }

      } catch (error) {
        console.error(`❌ Unexpected error processing activity ${activity.activity_id}:`, error);
        errorCount++;
        errors.push({ activity_id: activity.activity_id, error: error.message });
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