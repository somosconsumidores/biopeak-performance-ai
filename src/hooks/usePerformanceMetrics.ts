import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PerformanceMetrics {
  efficiency: {
    powerPerBeat: number | null;
    distancePerMinute: number | null;
    comment: string;
  };
  pace: {
    averageSpeedKmh: number | null;
    paceVariationCoefficient: number | null;
    comment: string;
  };
  heartRate: {
    averageHr: number | null;
    relativeIntensity: number | null;
    relativeReserve: number | null;
    comment: string;
  };
  effortDistribution: {
    beginning: number | null;
    middle: number | null;
    end: number | null;
    comment: string;
  };
}

interface UsePerformanceMetricsReturn {
  metrics: PerformanceMetrics | null;
  loading: boolean;
  error: string | null;
}

export const usePerformanceMetrics = (activityId: string): UsePerformanceMetricsReturn => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Clear metrics when activityId changes
    setMetrics(null);
    setError(null);
    setLoading(true);

    if (!activityId) {
      setLoading(false);
      return;
    }

    const fetchMetrics = async () => {
      try {
        console.log('🔄 Fetching pre-calculated performance metrics for activity:', activityId);
        const startTime = Date.now();
        
        // Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        // Fetch pre-calculated metrics from performance_metrics table
        console.log('📋 SQL Query for metrics:', `SELECT * FROM performance_metrics WHERE activity_id = '${activityId}' AND user_id = '${user.id}'`);
        
        const { data: metricsData, error: metricsError } = await supabase
          .from('performance_metrics')
          .select('*')
          .eq('activity_id', activityId)
          .eq('user_id', user.id)
          .single();

        if (metricsError) {
          // If no pre-calculated metrics found, trigger calculation
          if (metricsError.code === 'PGRST116') {
            console.log('⚡ No pre-calculated metrics found. Detecting activity source...');
            
            // Try to detect activity source (Strava, Polar, or Garmin)
            console.log('🔍 Detecting activity source. Activity ID:', activityId, 'User ID:', user.id);
            
            // Check if activityId is a UUID (contains hyphens) or a number
            let stravaActivity = null;
            let polarActivity = null;
            let stravaCheckError = null;
            let polarCheckError = null;
            
            if (activityId.includes('-')) {
              // It's a UUID, check by our internal ID
              const stravaResult = await supabase
                .from('strava_activities')
                .select('strava_activity_id, id')
                .eq('id', activityId)
                .eq('user_id', user.id)
                .single();
              stravaActivity = stravaResult.data;
              stravaCheckError = stravaResult.error;

              // Also check for Polar activity
              const polarResult = await supabase
                .from('polar_activities')
                .select('activity_id, id')
                .eq('id', activityId)
                .eq('user_id', user.id)
                .single();
              polarActivity = polarResult.data;
              polarCheckError = polarResult.error;
            } else {
              // It's a number, check by strava_activity_id and polar activity_id
              const stravaResult = await supabase
                .from('strava_activities')
                .select('strava_activity_id, id')
                .eq('strava_activity_id', parseInt(activityId))
                .eq('user_id', user.id)
                .single();
              stravaActivity = stravaResult.data;
              stravaCheckError = stravaResult.error;

              // Also check for Polar activity by activity_id (numeric)
              const polarResult = await supabase
                .from('polar_activities')
                .select('activity_id, id')
                .eq('activity_id', activityId)
                .eq('user_id', user.id)
                .single();
              polarActivity = polarResult.data;
              polarCheckError = polarResult.error;
            }
            
            console.log('🔍 Activity source check results:', { 
              stravaActivity, 
              stravaCheckError,
              polarActivity,
              polarCheckError 
            });

            let functionName = 'calculate-performance-metrics';
            let activityIdForFunction = activityId;
            
            if (stravaActivity) {
              console.log('🎯 Detected Strava activity, using Strava-specific metrics');
              functionName = 'calculate-strava-performance-metrics';
              // Always use the UUID for the function call
              activityIdForFunction = stravaActivity.id;
            } else if (polarActivity) {
              console.log('🎯 Detected Polar activity, using Polar-specific metrics');
              functionName = 'calculate-polar-performance-metrics';
              // Always use the UUID for the function call
              activityIdForFunction = polarActivity.id;
            }
            
            console.log('📞 Calling function:', functionName, 'with activity ID:', activityIdForFunction);
            
            const { error: functionError } = await supabase.functions.invoke(functionName, {
              body: { 
                activity_id: activityIdForFunction, 
                user_id: user.id 
              }
            });

            if (functionError) {
              console.log('⚠️ Function failed, calculating metrics locally as fallback');
              
              // Fallback: Calculate basic metrics locally for Strava activities
              if (stravaActivity) {
                const basicMetrics = await calculateBasicStravaMetrics(stravaActivity, user.id);
                if (basicMetrics) {
                  setMetrics(basicMetrics);
                  return;
                }
              }
              
              throw new Error(`Failed to calculate metrics: ${functionError.message}`);
            }

            // Retry fetching after calculation
            const { data: retryMetricsData, error: retryError } = await supabase
              .from('performance_metrics')
              .select('*')
              .eq('activity_id', activityId)
              .eq('user_id', user.id)
              .single();

            if (retryError) throw retryError;
            
            setMetrics(formatMetricsFromDB(retryMetricsData));
          } else {
            throw metricsError;
          }
        } else {
          setMetrics(formatMetricsFromDB(metricsData));
        }
        
        const endTime = Date.now();
        console.log(`✅ Performance metrics loaded in ${endTime - startTime}ms`);
        
      } catch (err: any) {
        console.error('❌ Error fetching performance metrics:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [activityId]);

  return { metrics, loading, error };
};

// Format metrics from database format to component format
function formatMetricsFromDB(dbMetrics: any): PerformanceMetrics {
  const isStravaActivity = dbMetrics.activity_source === 'strava';
  const isPolarActivity = dbMetrics.activity_source === 'polar';
  
  return {
    efficiency: {
      powerPerBeat: (isStravaActivity || isPolarActivity) ? null : dbMetrics.power_per_beat,
      distancePerMinute: dbMetrics.movement_efficiency || dbMetrics.distance_per_minute,
      comment: dbMetrics.efficiency_comment || "Sem dados suficientes"
    },
    pace: {
      averageSpeedKmh: dbMetrics.average_speed_kmh,
      paceVariationCoefficient: isStravaActivity ? dbMetrics.pace_consistency : dbMetrics.pace_variation_coefficient,
      comment: dbMetrics.pace_comment || "Sem dados suficientes"
    },
    heartRate: {
      averageHr: (isStravaActivity || isPolarActivity) ? null : dbMetrics.average_hr,
      relativeIntensity: (isStravaActivity || isPolarActivity) ? null : dbMetrics.relative_intensity,
      relativeReserve: (isStravaActivity || isPolarActivity) ? null : dbMetrics.relative_reserve,
      comment: dbMetrics.heart_rate_comment || "Sem dados suficientes"
    },
    effortDistribution: {
      beginning: isStravaActivity ? dbMetrics.pace_distribution_beginning : dbMetrics.effort_beginning_bpm,
      middle: isStravaActivity ? dbMetrics.pace_distribution_middle : dbMetrics.effort_middle_bpm,
      end: isStravaActivity ? dbMetrics.pace_distribution_end : dbMetrics.effort_end_bpm,
      comment: dbMetrics.effort_distribution_comment || "Sem dados suficientes"
    }
  };
}

// Fallback function to calculate basic metrics locally
async function calculateBasicStravaMetrics(stravaActivity: any, userId: string) {
  try {
    const durationMinutes = stravaActivity.moving_time / 60;
    const distanceKm = stravaActivity.distance / 1000;
    const avgSpeedMs = stravaActivity.average_speed;
    const avgPaceMinKm = avgSpeedMs > 0 ? (1000 / 60) / avgSpeedMs : null;

    // Calculate basic movement efficiency
    const movementEfficiency = durationMinutes > 0 ? distanceKm / durationMinutes : null;

    const basicMetrics = {
      efficiency: {
        powerPerBeat: null,
        distancePerMinute: movementEfficiency,
        comment: `Eficiência de movimento: ${movementEfficiency ? movementEfficiency.toFixed(2) + ' km/min' : 'Dados insuficientes'}`
      },
      pace: {
        averageSpeedKmh: avgSpeedMs * 3.6,
        paceVariationCoefficient: null,
        comment: `Pace médio: ${avgPaceMinKm ? avgPaceMinKm.toFixed(2) + ' min/km' : 'Dados indisponíveis'}`
      },
      heartRate: {
        averageHr: null,
        relativeIntensity: null,
        relativeReserve: null,
        comment: "Análise sem dados de frequência cardíaca"
      },
      effortDistribution: {
        beginning: null,
        middle: null,
        end: null,
        comment: "Dados insuficientes para análise de distribuição"
      }
    };

    return basicMetrics;
  } catch (error) {
    console.error('Error calculating basic metrics:', error);
    return null;
  }
}