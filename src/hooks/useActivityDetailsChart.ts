// Updated hook to use summary_id consistently
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
  const [hasRawData, setHasRawData] = useState(false);

  const fetchData = async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 DEBUG: Fetching data for activity ID:', id);
      
      // First check total count
      const { count, error: countError } = await supabase
        .from('garmin_activity_details')
        .select('*', { count: 'exact', head: true })
        .eq('activity_id', id)
        .not('total_distance_in_meters', 'is', null);

      if (countError) throw countError;
      console.log('🔍 DEBUG: Total records count:', count);
      setHasRawData((count || 0) > 0);

      // Fetch all data in chunks if needed
      const allDetails = [];
      const chunkSize = 1000;
      let currentOffset = 0;
      
      while (currentOffset < (count || 0)) {
        const { data: chunk, error: chunkError } = await supabase
          .from('garmin_activity_details')
          .select('heart_rate, speed_meters_per_second, total_distance_in_meters, samples, sample_timestamp')
          .eq('activity_id', id)
          .not('total_distance_in_meters', 'is', null)
          .order('total_distance_in_meters', { ascending: true })
          .range(currentOffset, currentOffset + chunkSize - 1);

        if (chunkError) throw chunkError;
        
        if (chunk && chunk.length > 0) {
          allDetails.push(...chunk);
          console.log(`🔍 DEBUG: Fetched chunk ${currentOffset}-${currentOffset + chunk.length - 1}, total so far: ${allDetails.length}`);
        }
        
        currentOffset += chunkSize;
        
        // Break if we got less than expected (end of data)
        if (!chunk || chunk.length < chunkSize) break;
      }
      
      console.log('🔍 DEBUG: Total records fetched:', allDetails.length);
      if (allDetails.length > 0) {
        const maxDistanceDB = Math.max(...allDetails.map(d => d.total_distance_in_meters || 0)) / 1000;
        console.log('🔍 DEBUG: Max distance in DB:', maxDistanceDB, 'km');
      }

      // Filter for records with heart rate
      const details = allDetails.filter(record => record.heart_rate !== null && record.heart_rate > 0);
      console.log('🔍 DEBUG: Records after HR filter:', details.length);
      
      if (details.length > 0) {
        const maxDistanceFiltered = Math.max(...details.map(d => d.total_distance_in_meters || 0)) / 1000;
        console.log('🔍 DEBUG: Max distance after HR filter:', maxDistanceFiltered, 'km');
      }
      
      const processedData = details.map((sample, index) => {
        // Calculate pace, handling zero speed cases
        let pace_min_per_km: number | null = null;
        if (sample.speed_meters_per_second && sample.speed_meters_per_second > 0) {
          pace_min_per_km = (1000 / sample.speed_meters_per_second) / 60;
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

      // Apply final filter - include records with valid heart rate and non-null speed
      const chartData = processedData
        .filter(item => {
          // Include records with valid heart rate and non-null speed
          return item.heart_rate > 0 && item.speed_meters_per_second > 0;
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
      setHasRawData(false);
    }
  }, [activityId]);

  return {
    data,
    loading,
    error,
    hasData: data.length > 0,
    hasRawData
  };
};