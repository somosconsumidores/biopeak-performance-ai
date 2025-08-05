import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StravaChartData {
  distance_km: number;
  pace_min_per_km: number | null;
  time_seconds: number;
}

interface UseStravaActivityChartReturn {
  data: StravaChartData[];
  loading: boolean;
  error: string | null;
  hasData: boolean;
}

export const useStravaActivityChart = (stravaActivityId: number | null): UseStravaActivityChartReturn => {
  const [data, setData] = useState<StravaChartData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stravaActivityId) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('Fetching Strava activity details for activity:', stravaActivityId);

        const { data: rawData, error } = await supabase
          .from('strava_activity_details')
          .select('distance, time_seconds, velocity_smooth')
          .eq('strava_activity_id', stravaActivityId)
          .not('distance', 'is', null)
          .not('velocity_smooth', 'is', null)
          .gt('velocity_smooth', 0) // Filter out stopped periods
          .order('time_index');

        if (error) {
          console.error('Error fetching Strava activity details:', error);
          throw error;
        }

        if (!rawData || rawData.length === 0) {
          console.log('No Strava activity details found for activity:', stravaActivityId);
          setData([]);
          return;
        }

        console.log(`Processing ${rawData.length} Strava data points`);

        // Process data and calculate pace
        const processedData: StravaChartData[] = rawData.map((point: any) => {
          const distanceKm = (point.distance || 0) / 1000;
          const velocityMs = point.velocity_smooth || 0;
          
          // Calculate pace from velocity (pace = 1000 / (velocity * 60) minutes per km)
          const paceMinPerKm = velocityMs > 0 ? (1000 / (velocityMs * 60)) : null;

          return {
            distance_km: distanceKm,
            pace_min_per_km: paceMinPerKm,
            time_seconds: point.time_seconds || 0,
          };
        });

        // Filter out invalid pace values and sample data for performance
        const validData = processedData.filter(point => 
          point.pace_min_per_km !== null && 
          point.pace_min_per_km > 0 && 
          point.pace_min_per_km < 20 // Filter out unrealistic pace values
        );

        // Sample data to improve performance (every 10th point for large datasets)
        const sampledData = validData.length > 1000 
          ? validData.filter((_, index) => index % 10 === 0)
          : validData;

        console.log(`Processed ${sampledData.length} valid Strava data points`);
        setData(sampledData);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('Error processing Strava activity chart data:', errorMessage);
        setError(errorMessage);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stravaActivityId]);

  return {
    data,
    loading,
    error,
    hasData: data.length > 0,
  };
};