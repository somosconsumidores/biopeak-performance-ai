import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface HeartRatePaceData {
  distance: number;
  heart_rate?: number;
  pace?: number;
  speed?: number;
}

export const useActivityDetailsChart = (activityId: string | null) => {
  const { user } = useAuth();
  const [data, setData] = useState<HeartRatePaceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasData = useMemo(() => data.length > 0, [data]);
  const hasRawData = useMemo(() => 
    data.some(point => point.heart_rate !== undefined || point.pace !== undefined)
  , [data]);

  // Check for optimized chart data first, fallback to ETL processing
  const fetchOptimizedData = async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('Checking optimized chart data for activity:', id);
      
      // First get the activity source from all_activities table
      const { data: activityData } = await supabase
        .from('all_activities')
        .select('activity_source')
        .eq('user_id', user.id)
        .eq('activity_id', id)
        .maybeSingle();

      const activitySource = activityData?.activity_source || 'garmin';
      console.log('Activity source detected:', activitySource);
      
      // Check activity_chart_data table
      const { data: chartData, error: chartError } = await supabase
        .from('activity_chart_data')
        .select('series_data, data_points_count')
        .eq('user_id', user.id)
        .eq('activity_id', id)
        .eq('activity_source', activitySource)
        .maybeSingle();

      if (chartError) {
        console.error('Chart data check error:', chartError);
        return false;
      }

      if (chartData?.series_data && chartData.data_points_count > 0) {
        console.log('Using optimized chart data:', chartData.data_points_count, 'points');
        setData(chartData.series_data || []);
        return true;
      }

      // No optimized data found, trigger ETL processing
      console.log('No optimized data found, triggering ETL processing...');
      
      try {
        const { error: etlError } = await supabase.functions.invoke('process-activity-data-etl', {
          body: { 
            user_id: user.id,
            activity_id: id,
            activity_source: activitySource
          }
        });

        if (etlError) {
          console.error('ETL processing error:', etlError);
          return false;
        }

        // After ETL processing, try to get the optimized data
        const { data: newChartData } = await supabase
          .from('activity_chart_data')
          .select('series_data, data_points_count')
          .eq('user_id', user.id)
          .eq('activity_id', id)
          .eq('activity_source', activitySource)
          .maybeSingle();

        if (newChartData?.series_data) {
          console.log('Using newly processed chart data:', newChartData.data_points_count, 'points');
          setData(newChartData.series_data || []);
          return true;
        }

      } catch (etlError) {
        console.error('Error in ETL processing:', etlError);
      }

      return false;
    } catch (error) {
      console.error('Error in optimized data fetch:', error);
      return false;
    }
  };

  const fetchData = async (id: string) => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    setData([]);

    try {
      // First try optimized data approach
      const optimizedSuccess = await fetchOptimizedData(id);
      if (optimizedSuccess) {
        setLoading(false);
        return;
      }

      console.log('Optimized data failed or unavailable, falling back to legacy method...');
      
      // Fallback to legacy method - simplified for this bridge implementation
      setError('Dados não disponíveis no momento. Tente novamente.');
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Erro ao buscar dados da atividade');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && activityId) {
      fetchData(activityId);
    }
  }, [user, activityId]);

  const refetch = () => {
    if (activityId) {
      fetchData(activityId);
    }
  };

  return { data, loading, error, hasData, hasRawData, refetch };
};