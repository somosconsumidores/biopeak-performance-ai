import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { activity_id } = await req.json();
    
    if (!activity_id) {
      return new Response(
        JSON.stringify({ error: 'activity_id is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📊 Exporting CSV data for activity: ${activity_id}`);

    // Query activity details
    const { data: activityDetails, error } = await supabase
      .from('garmin_activity_details')
      .select(`
        sample_timestamp,
        heart_rate,
        latitude_in_degree,
        longitude_in_degree,
        total_distance_in_meters,
        speed_meters_per_second,
        elevation_in_meters,
        power_in_watts,
        steps_per_minute,
        timer_duration_in_seconds,
        moving_duration_in_seconds,
        clock_duration_in_seconds
      `)
      .eq('activity_id', activity_id)
      .order('sample_timestamp', { ascending: true });

    if (error) {
      console.error('❌ Error querying activity details:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch activity data' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!activityDetails || activityDetails.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No data found for this activity' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`✅ Found ${activityDetails.length} data points`);

    // Generate CSV content
    const csvHeaders = [
      'timestamp_utc',
      'timestamp_iso',
      'heart_rate_bpm',
      'latitude',
      'longitude',
      'distance_meters',
      'speed_ms',
      'pace_min_km',
      'elevation_meters',
      'power_watts',
      'cadence_steps_min',
      'timer_duration_sec',
      'moving_duration_sec',
      'clock_duration_sec'
    ];

    const csvRows = activityDetails.map(point => {
      // Convert timestamp to readable format
      const timestamp = point.sample_timestamp;
      const date = new Date(timestamp * 1000);
      const isoString = date.toISOString();
      
      // Calculate pace (min/km) from speed (m/s)
      let paceMinKm = '';
      if (point.speed_meters_per_second && point.speed_meters_per_second > 0) {
        const speedKmh = point.speed_meters_per_second * 3.6;
        paceMinKm = (60 / speedKmh).toFixed(2);
      }

      return [
        timestamp || '',
        isoString || '',
        point.heart_rate || '',
        point.latitude_in_degree || '',
        point.longitude_in_degree || '',
        point.total_distance_in_meters || '',
        point.speed_meters_per_second || '',
        paceMinKm,
        point.elevation_in_meters || '',
        point.power_in_watts || '',
        point.steps_per_minute || '',
        point.timer_duration_in_seconds || '',
        point.moving_duration_in_seconds || '',
        point.clock_duration_in_seconds || ''
      ].join(',');
    });

    // Combine headers and rows
    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    console.log(`📁 Generated CSV with ${csvRows.length} rows`);

    // Return CSV file
    return new Response(csvContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="activity_${activity_id}_details.csv"`
      }
    });

  } catch (error) {
    console.error('❌ Unexpected error in export-activity-csv:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});