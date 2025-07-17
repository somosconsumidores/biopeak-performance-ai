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
            console.log('⚡ No pre-calculated metrics found. Triggering calculation...');
            
            const { error: functionError } = await supabase.functions.invoke('calculate-performance-metrics', {
              body: { 
                activity_id: activityId, 
                user_id: user.id 
              }
            });

            if (functionError) {
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
  return {
    efficiency: {
      powerPerBeat: dbMetrics.power_per_beat,
      distancePerMinute: dbMetrics.distance_per_minute,
      comment: dbMetrics.efficiency_comment || "Sem dados suficientes"
    },
    pace: {
      averageSpeedKmh: dbMetrics.average_speed_kmh,
      paceVariationCoefficient: dbMetrics.pace_variation_coefficient,
      comment: dbMetrics.pace_comment || "Sem dados suficientes"
    },
    heartRate: {
      averageHr: dbMetrics.average_hr,
      relativeIntensity: dbMetrics.relative_intensity,
      relativeReserve: dbMetrics.relative_reserve,
      comment: dbMetrics.heart_rate_comment || "Sem dados suficientes"
    },
    effortDistribution: {
      beginning: dbMetrics.effort_beginning_bpm,
      middle: dbMetrics.effort_middle_bpm,
      end: dbMetrics.effort_end_bpm,
      comment: dbMetrics.effort_distribution_comment || "Sem dados suficientes"
    }
  };
}