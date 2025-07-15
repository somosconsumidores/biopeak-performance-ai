import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HeartRatePaceData {
  distance_km: number;
  heart_rate: number;
  pace_min_per_km: number | null;
  speed_meters_per_second: number;
}

export const useActivityDetailsChart = (activityId: string | null) => {
  const [data, setData] = useState<HeartRatePaceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: details, error } = await supabase
        .from('garmin_activity_details')
        .select('heart_rate, speed_meters_per_second, total_distance_in_meters, samples')
        .eq('activity_id', id)
        .not('heart_rate', 'is', null)
        .not('total_distance_in_meters', 'is', null)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const chartData = (details || [])
        .map((sample, index) => {
          // Calculate pace, handling zero speed cases
          let pace_min_per_km: number | null = null;
          if (sample.speed_meters_per_second && sample.speed_meters_per_second > 0) {
            pace_min_per_km = (1000 / sample.speed_meters_per_second) / 60;
            // Filter out unrealistic pace values
            if (pace_min_per_km > 20) {
              pace_min_per_km = null;
            }
          }
          
          return {
            distance_km: sample.total_distance_in_meters! / 1000,
            heart_rate: sample.heart_rate!,
            pace_min_per_km: pace_min_per_km,
            speed_meters_per_second: sample.speed_meters_per_second || 0
          };
        })
        .filter(item => {
          // Only include records where heart rate is valid and pace is greater than zero
          return item.heart_rate > 0 && item.pace_min_per_km !== null && item.pace_min_per_km > 0;
        })
        .sort((a, b) => a.distance_km - b.distance_km);

      console.log('Chart data sample (first 10):', chartData.slice(0, 10));
      console.log('Chart data sample (last 10):', chartData.slice(-10));
      console.log('Total data points:', chartData.length);
      console.log('Zero pace points:', chartData.filter(item => item.pace_min_per_km === null).length);
      
      setData(chartData);
    } catch (err) {
      console.error('Error fetching activity details:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activityId) {
      fetchData(activityId);
    } else {
      setData([]);
      setError(null);
    }
  }, [activityId]);

  return {
    data,
    loading,
    error,
    hasData: data.length > 0
  };
};