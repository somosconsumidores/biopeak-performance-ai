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
      console.log('🔍 DEBUG: Fetching data for activity ID:', id);
      
      // First, get ALL data without heart rate filter to see total available
      const { data: allDetails, error: allError } = await supabase
        .from('garmin_activity_details')
        .select('heart_rate, speed_meters_per_second, total_distance_in_meters, samples, sample_timestamp')
        .eq('activity_id', id)
        .not('total_distance_in_meters', 'is', null)
        .order('total_distance_in_meters', { ascending: true });

      if (allError) throw allError;
      
      console.log('🔍 DEBUG: Total records from DB (no HR filter):', allDetails?.length || 0);
      if (allDetails && allDetails.length > 0) {
        const maxDistanceDB = Math.max(...allDetails.map(d => d.total_distance_in_meters || 0)) / 1000;
        console.log('🔍 DEBUG: Max distance in DB:', maxDistanceDB, 'km');
      }

      // Now apply heart rate filter
      const { data: details, error } = await supabase
        .from('garmin_activity_details')
        .select('heart_rate, speed_meters_per_second, total_distance_in_meters, samples, sample_timestamp')
        .eq('activity_id', id)
        .not('heart_rate', 'is', null)
        .not('total_distance_in_meters', 'is', null)
        .order('total_distance_in_meters', { ascending: true });

      if (error) throw error;
      
      console.log('🔍 DEBUG: Records after HR filter:', details?.length || 0);
      
      if (details && details.length > 0) {
        const maxDistanceFiltered = Math.max(...details.map(d => d.total_distance_in_meters || 0)) / 1000;
        console.log('🔍 DEBUG: Max distance after HR filter:', maxDistanceFiltered, 'km');
      }
      
      const processedData = (details || []).map((sample, index) => {
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
      });

      console.log('🔍 DEBUG: Records after processing:', processedData.length);
      if (processedData.length > 0) {
        const maxDistanceProcessed = Math.max(...processedData.map(d => d.distance_km));
        console.log('🔍 DEBUG: Max distance after processing:', maxDistanceProcessed, 'km');
      }

      // Count records before final filter
      const validHRRecords = processedData.filter(item => item.heart_rate > 0);
      const validPaceRecords = processedData.filter(item => item.pace_min_per_km !== null && item.pace_min_per_km > 0);
      const validBothRecords = processedData.filter(item => 
        item.heart_rate > 0 && item.pace_min_per_km !== null && item.pace_min_per_km > 0
      );

      console.log('🔍 DEBUG: Valid HR records:', validHRRecords.length);
      console.log('🔍 DEBUG: Valid pace records:', validPaceRecords.length);
      console.log('🔍 DEBUG: Valid both HR+pace records:', validBothRecords.length);

      // Apply final filter
      const chartData = processedData
        .filter(item => {
          // Only include records where heart rate is valid and pace is greater than zero
          return item.heart_rate > 0 && item.pace_min_per_km !== null && item.pace_min_per_km > 0;
        })
        .sort((a, b) => a.distance_km - b.distance_km);

      console.log('🔍 DEBUG: Final chart data points:', chartData.length);
      if (chartData.length > 0) {
        const maxDistanceFinal = Math.max(...chartData.map(d => d.distance_km));
        console.log('🔍 DEBUG: Max distance in final chart data:', maxDistanceFinal, 'km');
        console.log('🔍 DEBUG: First 5 chart points:', chartData.slice(0, 5));
        console.log('🔍 DEBUG: Last 5 chart points:', chartData.slice(-5));
      }

      // Check for gaps in distance
      if (chartData.length > 1) {
        const distances = chartData.map(d => d.distance_km).sort((a, b) => a - b);
        const gaps = [];
        for (let i = 1; i < distances.length; i++) {
          const gap = distances[i] - distances[i-1];
          if (gap > 0.5) { // Gap larger than 500m
            gaps.push({ from: distances[i-1], to: distances[i], gap });
          }
        }
        if (gaps.length > 0) {
          console.log('🔍 DEBUG: Large distance gaps found:', gaps);
        }
      }
      
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