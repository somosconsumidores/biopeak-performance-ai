import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HeartRatePaceData {
  timestamp: number;
  heart_rate: number;
  pace_min_per_km: number;
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
        .select('heart_rate, speed_meters_per_second, samples')
        .eq('activity_id', id)
        .not('heart_rate', 'is', null)
        .not('speed_meters_per_second', 'is', null)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const chartData = (details || [])
        .map((sample, index) => ({
          timestamp: index, // Use index as timestamp since sample_timestamp is null
          heart_rate: sample.heart_rate!,
          pace_min_per_km: sample.speed_meters_per_second! > 0 
            ? (1000 / sample.speed_meters_per_second!) / 60 // Convert to min/km
            : 0
        }))
        .filter(item => item.pace_min_per_km > 0 && item.pace_min_per_km < 20); // Filter out unrealistic pace values

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