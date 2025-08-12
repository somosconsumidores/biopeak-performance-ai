import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PerformanceMetrics {
  activity_source?: string;
  calories?: number;
  duration?: number;
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
    maxHr?: number | null;
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

        // 1) Detect source and normalize the activity ID up-front (prevents N/A due to ID mismatch)
        console.log('🔍 Detecting activity source. Activity ID:', activityId, 'User ID:', user.id);
        let stravaActivity: any = null;
        let polarActivity: any = null;
        let stravaCheckError: any = null;
        let polarCheckError: any = null;

        if (activityId.includes('-')) {
          // UUID provided: look up by our internal ID
          const stravaResult = await supabase
            .from('strava_activities')
            .select('id, strava_activity_id, moving_time, distance, average_speed, has_heartrate, average_heartrate')
            .eq('id', activityId)
            .eq('user_id', user.id)
            .single();
          stravaActivity = stravaResult.data;
          stravaCheckError = stravaResult.error;

          const polarResult = await supabase
            .from('polar_activities')
            .select('id, activity_id')
            .eq('id', activityId)
            .eq('user_id', user.id)
            .single();
          polarActivity = polarResult.data;
          polarCheckError = polarResult.error;
        } else {
          // Numeric provided: look up by external IDs
          const stravaResult = await supabase
            .from('strava_activities')
            .select('id, strava_activity_id, moving_time, distance, average_speed, has_heartrate, average_heartrate')
            .eq('strava_activity_id', parseInt(activityId))
            .eq('user_id', user.id)
            .single();
          stravaActivity = stravaResult.data;
          stravaCheckError = stravaResult.error;

          const polarResult = await supabase
            .from('polar_activities')
            .select('id, activity_id')
            .eq('activity_id', activityId)
            .eq('user_id', user.id)
            .single();
          polarActivity = polarResult.data;
          polarCheckError = polarResult.error;
        }

        console.log('🔍 Activity source check results:', { 
          stravaActivity, stravaCheckError, polarActivity, polarCheckError 
        });

        // Prefer our canonical UUID when available
        const candidateIds = Array.from(new Set([
          activityId,
          stravaActivity?.id,
          polarActivity?.id
        ].filter(Boolean)));

        // 2) Try to load pre-calculated metrics using any known candidate ID for this activity
        console.log('📋 SQL Query for metrics (candidates):', candidateIds);
        const { data: metricsData, error: metricsError } = await supabase
          .from('performance_metrics')
          .select('*')
          .in('activity_id', candidateIds as string[])
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (!metricsError && metricsData) {
          const formatted = formatMetricsFromDB(metricsData);
          const enriched = await hydratePolarMissingFields(formatted, metricsData.activity_id, user.id);
          setMetrics(enriched);
        } else {
          // If no pre-calculated metrics found, trigger calculation
          if (metricsError?.code === 'PGRST116') {
            console.log('⚡ No pre-calculated metrics found. Proceeding to calculate...');

            let functionName = 'calculate-performance-metrics';
            // Use canonical UUID when available for the function
            let activityIdForFunction: string = (stravaActivity?.id || polarActivity?.id || activityId);

            if (stravaActivity) {
              console.log('🎯 Detected Strava activity, using Strava-specific metrics');
              functionName = 'calculate-strava-performance-metrics';
            } else if (polarActivity) {
              console.log('🎯 Detected Polar activity, using Polar-specific metrics');
              functionName = 'calculate-polar-performance-metrics';
            }

            console.log('📞 Calling function:', functionName, 'with activity ID:', activityIdForFunction);
            const { error: functionError } = await supabase.functions.invoke(functionName, {
              body: { activity_id: activityIdForFunction, user_id: user.id }
            });

            if (functionError) {
              const msg = functionError.message || '';
              const isDuplicate = msg.includes('duplicate key') || msg.includes('already exists');
              if (isDuplicate) {
                console.log('ℹ️ Metrics already exist. Fetching stored metrics instead.');
                const { data: retryExisting, error: retryExistingErr } = await supabase
                  .from('performance_metrics')
                  .select('*')
                  .eq('activity_id', activityIdForFunction)
                  .eq('user_id', user.id)
                  .single();
                if (retryExistingErr) throw retryExistingErr;
                const formatted = formatMetricsFromDB(retryExisting);
                const enriched = await hydratePolarMissingFields(formatted, activityIdForFunction, user.id);
                setMetrics(enriched);
              } else {
                console.log('⚠️ Function failed, calculating metrics locally as fallback');
                if (stravaActivity) {
                  const basicMetrics = await calculateBasicStravaMetrics(stravaActivity, user.id);
                  if (basicMetrics) { setMetrics(basicMetrics); return; }
                } else if (polarActivity) {
                  const basicMetrics = await calculateBasicPolarMetrics(activityIdForFunction, user.id);
                  if (basicMetrics) { setMetrics(basicMetrics); return; }
                }
                throw new Error(`Failed to calculate metrics: ${functionError.message}`);
              }
            } else {
              // Retry fetching after successful calculation
              const { data: retryMetricsData, error: retryError } = await supabase
                .from('performance_metrics')
                .select('*')
                .eq('activity_id', activityIdForFunction)
                .eq('user_id', user.id)
                .single();
              if (retryError) throw retryError;
              const formatted = formatMetricsFromDB(retryMetricsData);
              const enriched = await hydratePolarMissingFields(formatted, activityIdForFunction, user.id);
              setMetrics(enriched);
            }
          } else if (metricsError) {
            throw metricsError;
          }
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
    activity_source: dbMetrics.activity_source,
    calories: dbMetrics.calories,
    duration: dbMetrics.duration_seconds,
    efficiency: {
      powerPerBeat: dbMetrics.power_per_beat ?? null,
      distancePerMinute: dbMetrics.movement_efficiency ?? dbMetrics.distance_per_minute ?? null,
      comment: dbMetrics.efficiency_comment || "Sem dados suficientes"
    },
    pace: {
      averageSpeedKmh: dbMetrics.average_speed_kmh ?? null,
      paceVariationCoefficient: dbMetrics.pace_variation_coefficient ?? dbMetrics.pace_consistency ?? null,
      comment: dbMetrics.pace_comment || "Sem dados suficientes"
    },
    heartRate: {
      averageHr: dbMetrics.average_hr ?? null,
      maxHr: dbMetrics.max_hr ?? null,
      relativeIntensity: dbMetrics.relative_intensity ?? null,
      relativeReserve: dbMetrics.relative_reserve ?? null,
      comment: dbMetrics.heart_rate_comment || "Sem dados suficientes"
    },
    effortDistribution: {
      beginning: dbMetrics.effort_beginning_bpm ?? dbMetrics.pace_distribution_beginning ?? null,
      middle: dbMetrics.effort_middle_bpm ?? dbMetrics.pace_distribution_middle ?? null,
      end: dbMetrics.effort_end_bpm ?? dbMetrics.pace_distribution_end ?? null,
      comment: dbMetrics.effort_distribution_comment || "Sem dados suficientes"
    }
  };
}

// Fallback function to calculate basic metrics locally for Strava
async function calculateBasicStravaMetrics(stravaActivity: any, userId: string) {
  try {
    const durationMinutes = stravaActivity.moving_time / 60;
    const distanceKm = stravaActivity.distance / 1000;
    const avgSpeedMs = stravaActivity.average_speed;
    const avgPaceMinKm = avgSpeedMs > 0 ? (1000 / 60) / avgSpeedMs : null;

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

// Fallback function to calculate basic metrics locally for Polar
async function calculateBasicPolarMetrics(activityUuidOrExternalId: string, userId: string) {
  try {
    // Try to fetch by UUID first, then by external activity_id
    let { data: activity } = await supabase
      .from('polar_activities')
      .select('*')
      .eq('id', activityUuidOrExternalId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!activity) {
      const fallback = await supabase
        .from('polar_activities')
        .select('*')
        .eq('activity_id', activityUuidOrExternalId)
        .eq('user_id', userId)
        .maybeSingle();
      activity = fallback.data;
    }

    if (!activity) return null;

    const durationSeconds = typeof activity.duration === 'number'
      ? activity.duration
      : (!isNaN(Number(activity.duration)) ? Number(activity.duration) : null);
    const durationMinutes = durationSeconds ? durationSeconds / 60 : null;
    const distanceKm = activity.distance ? Number(activity.distance) / 1000 : null;
    const avgSpeedKmh = (distanceKm && durationMinutes) ? (distanceKm / durationMinutes) * 60 : null;
    const avgPaceMinKm = avgSpeedKmh ? 60 / avgSpeedKmh : null;
    const movementEfficiency = (distanceKm && durationMinutes) ? distanceKm / durationMinutes : null;

    return {
      activity_source: 'polar',
      calories: activity.calories || null,
      duration: durationSeconds || null,
      efficiency: {
        powerPerBeat: null,
        distancePerMinute: movementEfficiency,
        comment: movementEfficiency ? `Eficiência de movimento: ${movementEfficiency.toFixed(3)} km/min` : 'Dados insuficientes'
      },
      pace: {
        averageSpeedKmh: avgSpeedKmh,
        paceVariationCoefficient: null,
        comment: avgPaceMinKm ? `Pace médio: ${avgPaceMinKm.toFixed(2)} min/km` : 'Dados indisponíveis'
      },
      heartRate: {
        averageHr: activity.average_heart_rate_bpm || null,
        maxHr: activity.maximum_heart_rate_bpm || null,
        relativeIntensity: null,
        relativeReserve: null,
        comment: activity.average_heart_rate_bpm ? 
          `FC média: ${activity.average_heart_rate_bpm} bpm` : 
          'Sem dados de FC para análise detalhada'
      },
      effortDistribution: {
        beginning: null,
        middle: null,
        end: null,
        comment: 'Dados insuficientes para distribuição de esforço'
      }
    } as PerformanceMetrics;
  } catch (error) {
    console.error('Error calculating basic polar metrics:', error);
    return null;
  }
}

// Enrich Polar metrics with missing calories/duration from polar_activities if absent
async function hydratePolarMissingFields(
  m: PerformanceMetrics,
  activityId: string,
  userId: string
): Promise<PerformanceMetrics> {
  try {
    if (m?.activity_source !== 'polar' || (m.calories != null && m.duration != null)) {
      return m;
    }

    // Try by UUID first
    let { data: activity } = await supabase
      .from('polar_activities')
      .select('calories, duration')
      .eq('id', activityId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!activity) {
      const fallback = await supabase
        .from('polar_activities')
        .select('calories, duration')
        .eq('activity_id', activityId)
        .eq('user_id', userId)
        .maybeSingle();
      activity = fallback.data;
    }

    if (!activity) return m;

    const parsedDuration = parseDurationToSeconds(activity.duration);

    return {
      ...m,
      calories: m.calories ?? (typeof activity.calories === 'number' ? activity.calories : null),
      duration: m.duration ?? parsedDuration ?? null,
    };
  } catch (e) {
    console.warn('hydratePolarMissingFields failed:', e);
    return m;
  }
}

function parseDurationToSeconds(iso: string | number | null | undefined): number | null {
  if (iso == null) return null;
  try {
    if (typeof iso === 'number') return Math.round(iso);
    const s = String(iso).trim();
    if (!s) return null;

    // seconds string
    if (/^\d+(?:\.\d+)?$/.test(s)) return Math.round(parseFloat(s));

    // HH:MM:SS
    const hms = s.match(/^(\d{1,2}):([0-5]?\d):([0-5]?\d)$/);
    if (hms) {
      const h = parseInt(hms[1], 10);
      const m = parseInt(hms[2], 10);
      const sec = parseInt(hms[3], 10);
      return h * 3600 + m * 60 + sec;
    }

    // ISO8601 duration
    const match = s.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
    if (match) {
      const days = parseInt(match[1] || '0', 10);
      const hours = parseInt(match[2] || '0', 10);
      const minutes = parseInt(match[3] || '0', 10);
      const seconds = parseFloat(match[4] || '0');
      return Math.round(days * 86400 + hours * 3600 + minutes * 60 + seconds);
    }

    return null;
  } catch {
    return null;
  }
}
