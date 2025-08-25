import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatMetricsFromChartData } from './usePerformanceMetricsFromChartData';

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
        console.log('🔄 Fetching performance metrics for activity:', activityId);
        const startTime = Date.now();
        
        // Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        // PRIORITY 1: Try to get from activity_chart_data (for Garmin and Strava)
        const { data: chartData, error: chartError } = await supabase
          .from('activity_chart_data')
          .select('*')
          .eq('activity_id', activityId)
          .single();

        if (chartData && !chartError) {
          console.log('✅ Using activity_chart_data for performance metrics');
          const metrics = formatMetricsFromChartData(chartData);
          setMetrics(metrics);
          setLoading(false);
          return;
        }

        console.log('📋 Fallback: trying pre-calculated performance metrics');
        
        // PRIORITY 2: Get pre-calculated metrics (existing logic)
        const { data: metricsData, error: metricsError } = await supabase
          .from('performance_metrics')
          .select('*')
          .eq('activity_id', activityId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (metricsData) {
          const formatted = formatMetricsFromDB(metricsData);
          setMetrics(formatted);
        } else {
          // ... keep existing fallback code
          throw new Error('No performance data available');
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
  // Normalize distance per minute to km/min
  const rawDpm = dbMetrics.distance_per_minute ?? dbMetrics.movement_efficiency ?? null;
  let distancePerMinute: number | null = rawDpm != null ? Number(rawDpm) : null;
  if (distancePerMinute != null && !isNaN(distancePerMinute)) {
    // Heuristic: values > 5 are likely m/min -> convert to km/min
    distancePerMinute = distancePerMinute > 5 ? distancePerMinute / 1000 : distancePerMinute;
  } else {
    distancePerMinute = null;
  }

  const averageSpeedKmh: number | null = dbMetrics.average_speed_kmh ?? null;
  const paceVar: number | null = dbMetrics.pace_variation_coefficient ?? dbMetrics.pace_consistency ?? null;
  const avgHr: number | null = dbMetrics.average_hr ?? null;
  const maxHr: number | null = dbMetrics.max_hr ?? null;
  const relIntensity: number | null = dbMetrics.relative_intensity ?? null;
  const relReserve: number | null = dbMetrics.relative_reserve ?? null;

  // Auto-generate helpful comments when absent
  let efficiencyComment: string = dbMetrics.efficiency_comment || '';
  if ((!efficiencyComment || efficiencyComment === 'Sem dados suficientes') && distancePerMinute != null) {
    efficiencyComment = `Eficiência de movimento: ${distancePerMinute.toFixed(2)} km/min`;
  }

  let paceComment: string = dbMetrics.pace_comment || '';
  if ((!paceComment || paceComment === 'Sem dados suficientes') && typeof averageSpeedKmh === 'number') {
    const avgSpeedMs = averageSpeedKmh / 3.6;
    const avgPaceMinKm = avgSpeedMs > 0 ? (1000 / avgSpeedMs) / 60 : null;
    if (avgPaceMinKm != null) paceComment = `Pace médio: ${avgPaceMinKm.toFixed(2)} min/km`;
  }

  let hrComment: string = dbMetrics.heart_rate_comment || '';
  if ((!hrComment || hrComment === 'Sem dados suficientes') && avgHr != null) {
    hrComment = `FC média: ${avgHr} bpm`;
  }

  return {
    activity_source: dbMetrics.activity_source,
    calories: dbMetrics.calories,
    duration: dbMetrics.duration_seconds,
    efficiency: {
      powerPerBeat: dbMetrics.power_per_beat ?? null,
      distancePerMinute,
      comment: efficiencyComment || 'Sem dados suficientes'
    },
    pace: {
      averageSpeedKmh,
      paceVariationCoefficient: paceVar,
      comment: paceComment || 'Sem dados suficientes'
    },
    heartRate: {
      averageHr: avgHr,
      maxHr: maxHr,
      relativeIntensity: relIntensity,
      relativeReserve: relReserve,
      comment: hrComment || 'Sem dados suficientes'
    },
    effortDistribution: {
      beginning: dbMetrics.effort_beginning_bpm ?? dbMetrics.pace_distribution_beginning ?? null,
      middle: dbMetrics.effort_middle_bpm ?? dbMetrics.pace_distribution_middle ?? null,
      end: dbMetrics.effort_end_bpm ?? dbMetrics.pace_distribution_end ?? null,
      comment: dbMetrics.effort_distribution_comment || 'Sem dados suficientes'
    }
  };
}

// Enrich Strava metrics using activity summary if DB metrics have gaps
function enrichStravaUsingSummary(m: PerformanceMetrics, summary?: any): PerformanceMetrics {
  if (!summary) return m;
  const cloned = { ...m, efficiency: { ...m.efficiency }, pace: { ...m.pace }, heartRate: { ...m.heartRate } } as PerformanceMetrics;
  // Ensure source tag for downstream UI logic
  if (!cloned.activity_source) cloned.activity_source = 'strava';

  // Fill efficiency.distancePerMinute from distance/moving_time
  if (cloned.efficiency.distancePerMinute == null && typeof summary.distance === 'number' && typeof summary.moving_time === 'number' && summary.moving_time > 0) {
    const km = summary.distance / 1000;
    const minutes = summary.moving_time / 60;
    cloned.efficiency.distancePerMinute = minutes > 0 ? km / minutes : null;
    if (!cloned.efficiency.comment || cloned.efficiency.comment === 'Sem dados suficientes') {
      cloned.efficiency.comment = cloned.efficiency.distancePerMinute != null
        ? `Eficiência de movimento: ${cloned.efficiency.distancePerMinute.toFixed(2)} km/min`
        : 'Sem dados suficientes';
    }
  }

  // Fill pace.averageSpeedKmh from average_speed (m/s)
  if (cloned.pace.averageSpeedKmh == null && typeof summary.average_speed === 'number') {
    cloned.pace.averageSpeedKmh = summary.average_speed * 3.6;
    if (!cloned.pace.comment || cloned.pace.comment === 'Sem dados suficientes') {
      const avgSpeedMs = summary.average_speed;
      const avgPaceMinKm = avgSpeedMs > 0 ? (1000 / avgSpeedMs) / 60 : null;
      cloned.pace.comment = avgPaceMinKm ? `Pace médio: ${avgPaceMinKm.toFixed(2)} min/km` : 'Sem dados suficientes';
    }
  }

  // Fill heartRate.averageHr from summary average_heartrate
  if ((cloned.heartRate.averageHr == null) && (typeof summary.average_heartrate === 'number')) {
    cloned.heartRate.averageHr = summary.average_heartrate;
    if (!cloned.heartRate.comment || cloned.heartRate.comment === 'Sem dados suficientes') {
      cloned.heartRate.comment = `FC média: ${summary.average_heartrate} bpm`;
    }
  }

  return cloned;
}

// Fallback function to calculate basic metrics locally for Strava
async function calculateBasicStravaMetrics(stravaActivity: any, userId: string) {
  try {
    const durationMinutes = stravaActivity.moving_time / 60;
    const distanceKm = stravaActivity.distance / 1000;
    const avgSpeedMs = stravaActivity.average_speed;
    const avgPaceMinKm = avgSpeedMs > 0 ? (1000 / 60) / avgSpeedMs : null;

    const movementEfficiency = durationMinutes > 0 ? distanceKm / durationMinutes : null;

    const basicMetrics: PerformanceMetrics = {
      activity_source: 'strava',
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
        averageHr: typeof stravaActivity.average_heartrate === 'number' ? stravaActivity.average_heartrate : null,
        relativeIntensity: null,
        relativeReserve: null,
        comment: typeof stravaActivity.average_heartrate === 'number' ? `FC média: ${stravaActivity.average_heartrate} bpm` : 'Análise sem dados de frequência cardíaca'
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

// Basic fallback metrics for GPX activities (uses summary fields from strava_gpx_activities)
async function calculateBasicGpxMetrics(gpxActivity: any, userId: string) {
  try {
    const durationSeconds = typeof gpxActivity.duration_in_seconds === 'number'
      ? gpxActivity.duration_in_seconds
      : parseDurationToSeconds(gpxActivity.duration);

    const distanceKm = typeof gpxActivity.distance_in_meters === 'number'
      ? gpxActivity.distance_in_meters / 1000
      : (typeof gpxActivity.total_distance_m === 'number' ? gpxActivity.total_distance_m / 1000 : null);

    const avgSpeedKmh = typeof gpxActivity.average_speed_in_meters_per_second === 'number'
      ? gpxActivity.average_speed_in_meters_per_second * 3.6
      : (durationSeconds && distanceKm ? (distanceKm / (durationSeconds / 3600)) : null);

    const avgPaceMinKm = avgSpeedKmh ? 60 / avgSpeedKmh : null;
    const durationMinutes = durationSeconds ? durationSeconds / 60 : null;
    const movementEfficiency = (distanceKm && durationMinutes) ? distanceKm / durationMinutes : null;

    return {
      activity_source: 'gpx',
      calories: typeof gpxActivity.calories === 'number' ? gpxActivity.calories : null,
      duration: durationSeconds ?? null,
      efficiency: {
        powerPerBeat: null,
        distancePerMinute: movementEfficiency,
        comment: movementEfficiency ? `Eficiência de movimento: ${movementEfficiency.toFixed(2)} km/min` : 'Dados insuficientes'
      },
      pace: {
        averageSpeedKmh: avgSpeedKmh ?? null,
        paceVariationCoefficient: null,
        comment: avgPaceMinKm ? `Pace médio: ${avgPaceMinKm.toFixed(2)} min/km` : 'Dados indisponíveis'
      },
      heartRate: {
        averageHr: typeof gpxActivity.average_heart_rate === 'number' ? Math.round(gpxActivity.average_heart_rate) : null,
        maxHr: typeof gpxActivity.max_heart_rate === 'number' ? Math.round(gpxActivity.max_heart_rate) : null,
        relativeIntensity: null,
        relativeReserve: null,
        comment: typeof gpxActivity.average_heart_rate === 'number' ? `FC média: ${Math.round(gpxActivity.average_heart_rate)} bpm` : 'Sem dados de FC para análise detalhada'
      },
      effortDistribution: {
        beginning: null,
        middle: null,
        end: null,
        comment: 'Dados insuficientes para distribuição'
      }
    } as PerformanceMetrics;
  } catch (e) {
    console.error('Error calculating basic GPX metrics:', e);
    return null;
  }
}
