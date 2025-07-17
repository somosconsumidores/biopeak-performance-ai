import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PerformanceMetrics {
  user_id: string;
  activity_id: string;
  power_per_beat?: number;
  distance_per_minute?: number;
  efficiency_comment?: string;
  average_speed_kmh?: number;
  pace_variation_coefficient?: number;
  pace_comment?: string;
  average_hr?: number;
  relative_intensity?: number;
  relative_reserve?: number;
  heart_rate_comment?: string;
  effort_beginning_bpm?: number;
  effort_middle_bpm?: number;
  effort_end_bpm?: number;
  effort_distribution_comment?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { activity_id, user_id } = await req.json();
    
    if (!activity_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'activity_id and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔄 Calculating performance metrics for activity ${activity_id}, user ${user_id}`);

    // Get activity data
    const { data: activity, error: activityError } = await supabase
      .from('garmin_activities')
      .select('*')
      .eq('activity_id', activity_id)
      .eq('user_id', user_id)
      .single();

    if (activityError || !activity) {
      console.error('❌ Activity not found:', activityError);
      return new Response(
        JSON.stringify({ error: 'Activity not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get activity details
    const { data: activityDetails, error: detailsError } = await supabase
      .from('garmin_activity_details')
      .select('speed_meters_per_second, heart_rate, power_in_watts, sample_timestamp, clock_duration_in_seconds')
      .eq('activity_id', activity_id)
      .eq('user_id', user_id)
      .not('heart_rate', 'is', null)
      .not('clock_duration_in_seconds', 'is', null)
      .order('clock_duration_in_seconds', { ascending: true });

    if (detailsError) {
      console.error('❌ Error fetching activity details:', detailsError);
      return new Response(
        JSON.stringify({ error: 'Error fetching activity details' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${activityDetails?.length || 0} detail records for calculation`);

    // Calculate performance metrics
    const metrics = calculatePerformanceMetrics(activity, activityDetails || []);
    
    // Save to performance_metrics table
    const { error: insertError } = await supabase
      .from('performance_metrics')
      .upsert({
        ...metrics,
        user_id,
        activity_id,
        calculated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('❌ Error saving performance metrics:', insertError);
      return new Response(
        JSON.stringify({ error: 'Error saving performance metrics', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Performance metrics calculated and saved for activity ${activity_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        metrics,
        details_count: activityDetails?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculatePerformanceMetrics(activity: any, details: any[]): PerformanceMetrics {
  const metrics: PerformanceMetrics = {
    user_id: activity.user_id,
    activity_id: activity.activity_id
  };

  // Efficiency calculations
  if (activity.average_heart_rate_in_beats_per_minute && activity.duration_in_seconds) {
    const totalBeats = activity.average_heart_rate_in_beats_per_minute * (activity.duration_in_seconds / 60);
    
    if (activity.active_kilocalories && totalBeats > 0) {
      metrics.power_per_beat = Number((activity.active_kilocalories / totalBeats).toFixed(2));
      
      if (metrics.power_per_beat >= 0.08) {
        metrics.efficiency_comment = "Excelente eficiência energética";
      } else if (metrics.power_per_beat >= 0.06) {
        metrics.efficiency_comment = "Boa eficiência energética";
      } else if (metrics.power_per_beat >= 0.04) {
        metrics.efficiency_comment = "Eficiência moderada";
      } else {
        metrics.efficiency_comment = "Baixa eficiência energética";
      }
    }

    if (activity.distance_in_meters) {
      metrics.distance_per_minute = Number((activity.distance_in_meters / (activity.duration_in_seconds / 60)).toFixed(1));
    }
  }

  // Pace calculations
  if (activity.average_speed_in_meters_per_second) {
    metrics.average_speed_kmh = Number((activity.average_speed_in_meters_per_second * 3.6).toFixed(1));
  }

  // Calculate pace variation from details
  if (details.length > 0) {
    const speeds = details
      .filter(d => d.speed_meters_per_second !== null && d.speed_meters_per_second > 0)
      .map(d => d.speed_meters_per_second);
    
    if (speeds.length > 1) {
      const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      const variance = speeds.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / speeds.length;
      const stdDev = Math.sqrt(variance);
      metrics.pace_variation_coefficient = Number(((stdDev / mean) * 100).toFixed(1));
      
      if (metrics.pace_variation_coefficient <= 15) {
        metrics.pace_comment = "Ritmo muito consistente";
      } else if (metrics.pace_variation_coefficient <= 25) {
        metrics.pace_comment = "Ritmo moderadamente consistente";
      } else {
        metrics.pace_comment = "Ritmo inconsistente";
      }
    }
  }

  // Heart Rate calculations
  if (activity.average_heart_rate_in_beats_per_minute) {
    metrics.average_hr = activity.average_heart_rate_in_beats_per_minute;
    
    if (activity.max_heart_rate_in_beats_per_minute) {
      metrics.relative_intensity = Number(((activity.average_heart_rate_in_beats_per_minute / activity.max_heart_rate_in_beats_per_minute) * 100).toFixed(1));
      
      // Assuming 220 - age formula for max HR, we'll use the recorded max as reference
      const estimatedMaxHr = activity.max_heart_rate_in_beats_per_minute;
      const restingHr = 60; // Assuming resting HR of 60
      const hrReserve = estimatedMaxHr - restingHr;
      metrics.relative_reserve = Number((((activity.average_heart_rate_in_beats_per_minute - restingHr) / hrReserve) * 100).toFixed(1));
      
      if (metrics.relative_intensity >= 90) {
        metrics.heart_rate_comment = "Intensidade muito alta";
      } else if (metrics.relative_intensity >= 80) {
        metrics.heart_rate_comment = "Intensidade alta";
      } else if (metrics.relative_intensity >= 70) {
        metrics.heart_rate_comment = "Intensidade moderada";
      } else {
        metrics.heart_rate_comment = "Intensidade baixa";
      }
    }
  }

  // Effort Distribution calculation (chronological segments)
  if (details.length >= 3) {
    const heartRates = details
      .filter(d => d.heart_rate !== null)
      .map(d => d.heart_rate);
    
    if (heartRates.length >= 3) {
      const third = Math.floor(heartRates.length / 3);
      
      metrics.effort_beginning_bpm = Math.round(heartRates.slice(0, third).reduce((a, b) => a + b, 0) / third);
      metrics.effort_middle_bpm = Math.round(heartRates.slice(third, 2 * third).reduce((a, b) => a + b, 0) / third);
      metrics.effort_end_bpm = Math.round(heartRates.slice(2 * third).reduce((a, b) => a + b, 0) / (heartRates.length - 2 * third));
      
      const maxEffort = Math.max(metrics.effort_beginning_bpm, metrics.effort_middle_bpm, metrics.effort_end_bpm);
      const minEffort = Math.min(metrics.effort_beginning_bpm, metrics.effort_middle_bpm, metrics.effort_end_bpm);
      
      if (maxEffort - minEffort <= 10) {
        metrics.effort_distribution_comment = "Esforço muito consistente";
      } else if (maxEffort - minEffort <= 20) {
        metrics.effort_distribution_comment = "Esforço moderadamente consistente";
      } else {
        metrics.effort_distribution_comment = "Esforço variável";
      }
    }
  }

  return metrics;
}