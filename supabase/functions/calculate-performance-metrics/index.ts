import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";
import { handleError } from '../_shared/error-handler.ts';

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

  return await handleError('calculate-performance-metrics', async () => {
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

    // Try to get activity data from multiple sources
    let activity = null;
    
    // First try Garmin activities
    const { data: garminActivity, error: garminError } = await supabase
      .from('garmin_activities')
      .select('*')
      .eq('activity_id', activity_id)
      .eq('user_id', user_id)
      .single();

    if (garminActivity) {
      activity = garminActivity;
      console.log('✅ Found Garmin activity');
    } else {
      // Try Zepp GPX activities if not found in Garmin
      const { data: zeppActivity, error: zeppError } = await supabase
        .from('zepp_gpx_activities')
        .select('*')
        .eq('activity_id', activity_id)
        .eq('user_id', user_id)
        .single();

      if (zeppActivity) {
        // Map Zepp fields to Garmin-like structure for compatibility
        activity = {
          ...zeppActivity,
          average_heart_rate_in_beats_per_minute: zeppActivity.average_heart_rate,
          max_heart_rate_in_beats_per_minute: zeppActivity.max_heart_rate,
          average_speed_in_meters_per_second: zeppActivity.average_speed_ms,
          duration_in_seconds: zeppActivity.duration_in_seconds,
          distance_in_meters: zeppActivity.distance_in_meters,
          active_kilocalories: zeppActivity.calories
        };
        console.log('✅ Found Zepp GPX activity, mapped to Garmin structure');
      }
    }

    if (!activity) {
      console.error('❌ Activity not found in any source:', { garminError, activity_id, user_id });
      return new Response(
        JSON.stringify({ error: 'Activity not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get activity details in batches to overcome 1000 record limit
    console.log('🔍 Fetching activity details in batches...');
    let allActivityDetails: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;
    let detailsSource = 'garmin';

    // First try Garmin activity details
    while (hasMore) {
      const { data: batchDetails, error: detailsError } = await supabase
        .from('garmin_activity_details')
        .select('speed_meters_per_second, heart_rate, power_in_watts, sample_timestamp, clock_duration_in_seconds')
        .eq('activity_id', activity_id)
        .eq('user_id', user_id)
        .not('heart_rate', 'is', null)
        .not('clock_duration_in_seconds', 'is', null)
        .order('clock_duration_in_seconds', { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (detailsError) {
        console.error('❌ Error fetching Garmin activity details:', detailsError);
        break;
      }

      if (batchDetails && batchDetails.length > 0) {
        allActivityDetails = allActivityDetails.concat(batchDetails);
        console.log(`📦 Fetched Garmin batch ${Math.floor(offset/batchSize) + 1}: ${batchDetails.length} records (total: ${allActivityDetails.length})`);
        
        if (batchDetails.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
      } else {
        hasMore = false;
      }
    }

    // If no Garmin details found, try Zepp GPX details
    if (allActivityDetails.length === 0) {
      console.log('🔍 No Garmin details found, trying Zepp GPX details...');
      detailsSource = 'zepp_gpx';
      offset = 0;
      hasMore = true;

      while (hasMore) {
        const { data: batchDetails, error: detailsError } = await supabase
          .from('zepp_gpx_activity_details')
          .select('speed_meters_per_second, heart_rate, sample_timestamp, total_distance_in_meters')
          .eq('activity_id', activity_id)
          .eq('user_id', user_id)
          .not('heart_rate', 'is', null)
          .order('sample_timestamp', { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (detailsError) {
          console.error('❌ Error fetching Zepp GPX activity details:', detailsError);
          return new Response(
            JSON.stringify({ error: 'Error fetching activity details' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (batchDetails && batchDetails.length > 0) {
          // Map Zepp details to Garmin-like structure
          const mappedDetails = batchDetails.map(detail => ({
            ...detail,
            clock_duration_in_seconds: null, // Zepp doesn't have this field
            power_in_watts: null // Zepp doesn't have power data
          }));
          
          allActivityDetails = allActivityDetails.concat(mappedDetails);
          console.log(`📦 Fetched Zepp GPX batch ${Math.floor(offset/batchSize) + 1}: ${batchDetails.length} records (total: ${allActivityDetails.length})`);
          
          if (batchDetails.length < batchSize) {
            hasMore = false;
          } else {
            offset += batchSize;
          }
        } else {
          hasMore = false;
        }
      }
    }

    console.log(`📊 Found ${allActivityDetails.length} total detail records for calculation`);

    // Calculate performance metrics
    const metrics = calculatePerformanceMetrics(activity, allActivityDetails);
    
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
        details_count: allActivityDetails.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  });
});

function calculatePerformanceMetrics(activity: any, details: any[]): PerformanceMetrics {
  const metrics: PerformanceMetrics = {
    user_id: activity.user_id,
    activity_id: activity.activity_id
  };

  // Efficiency calculations
  if (activity.average_heart_rate_in_beats_per_minute && activity.duration_in_seconds) {
    // Calculate average power from details if available
    let averagePower = null;
    if (details.length > 0) {
      const powerReadings = details
        .filter(d => d.power_in_watts !== null && d.power_in_watts > 0)
        .map(d => d.power_in_watts);
      
      if (powerReadings.length > 0) {
        averagePower = powerReadings.reduce((a, b) => a + b, 0) / powerReadings.length;
      }
    }
    
    // If we have actual power data, calculate power per beat
    if (averagePower && averagePower > 0) {
      metrics.power_per_beat = Number((averagePower / activity.average_heart_rate_in_beats_per_minute).toFixed(2));
      
      if (metrics.power_per_beat >= 2.0) {
        metrics.efficiency_comment = "Excelente eficiência de potência";
      } else if (metrics.power_per_beat >= 1.5) {
        metrics.efficiency_comment = "Boa eficiência de potência";
      } else if (metrics.power_per_beat >= 1.0) {
        metrics.efficiency_comment = "Eficiência moderada de potência";
      } else {
        metrics.efficiency_comment = "Baixa eficiência de potência";
      }
    } else {
      // Fallback: Calculate metabolic efficiency from calories if no power data
      const totalBeats = activity.average_heart_rate_in_beats_per_minute * (activity.duration_in_seconds / 60);
      if (activity.active_kilocalories && totalBeats > 0) {
        const caloriesPerBeat = activity.active_kilocalories / totalBeats;
        
        if (caloriesPerBeat >= 0.08) {
          metrics.efficiency_comment = "Excelente eficiência metabólica";
        } else if (caloriesPerBeat >= 0.06) {
          metrics.efficiency_comment = "Boa eficiência metabólica";
        } else if (caloriesPerBeat >= 0.04) {
          metrics.efficiency_comment = "Eficiência metabólica moderada";
        } else {
          metrics.efficiency_comment = "Baixa eficiência metabólica";
        }
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