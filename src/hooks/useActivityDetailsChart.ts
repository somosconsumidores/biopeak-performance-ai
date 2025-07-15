import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HeartRatePaceData {
  timestamp: number;
  heart_rate: number;
  pace_min_per_km: number;
}

export const useActivityDetailsChart = (summaryId: string | null) => {
  const [data, setData] = useState<HeartRatePaceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: details, error } = await supabase
        .from('garmin_activity_details')
        .select('sample_timestamp, heart_rate, speed_meters_per_second')
        .eq('summary_id', id)
        .not('sample_timestamp', 'is', null)
        .not('heart_rate', 'is', null)
        .not('speed_meters_per_second', 'is', null)
        .order('sample_timestamp', { ascending: true });

      if (error) throw error;
      
      const chartData = (details || [])
        .map(sample => ({
          timestamp: sample.sample_timestamp,
          heart_rate: sample.heart_rate!,
          pace_min_per_km: sample.speed_meters_per_second! > 0 
            ? (1000 / sample.speed_meters_per_second!) / 60 // Convert to min/km
            : 0
        }))
        .filter(item => item.pace_min_per_km > 0 && item.pace_min_per_km < 20) // Filter out unrealistic pace values
        .sort((a, b) => a.timestamp - b.timestamp);

      setData(chartData);
    } catch (err) {
      console.error('Error fetching activity details:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (summaryId) {
      fetchData(summaryId);
    } else {
      setData([]);
      setError(null);
    }
  }, [summaryId]);

  return {
    data,
    loading,
    error,
    hasData: data.length > 0
  };
};