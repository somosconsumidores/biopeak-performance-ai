import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface HeartRatePaceData {
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
      
      // First check activity_chart_data table
      const { data: chartData, error: chartError } = await supabase
        .from('activity_chart_data')
        .select('series_data, data_points_count')
        .eq('user_id', user.id)
        .eq('activity_id', id)
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
            activity_source: 'garmin' // Default to garmin, could be dynamic
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
      
      // Try Garmin data first
      let allDetails = [];
      let dataSource = 'garmin';
      
      // First check Garmin total count
      const { count: garminCount, error: garminCountError } = await supabase
        .from('garmin_activity_details')
        .select('*', { count: 'exact', head: true })
        .eq('activity_id', id)
        .not('total_distance_in_meters', 'is', null);

      if (garminCountError) throw garminCountError;
      console.log('🔍 DEBUG: Garmin records count:', garminCount);

      if (garminCount && garminCount > 0) {
        // Fetch Garmin data in chunks
        const chunkSize = 1000;
        let currentOffset = 0;
        
        while (currentOffset < garminCount) {
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
            console.log(`🔍 DEBUG: Fetched Garmin chunk ${currentOffset}-${currentOffset + chunk.length - 1}, total so far: ${allDetails.length}`);
          }
          
          currentOffset += chunkSize;
          
          // Break if we got less than expected (end of data)
          if (!chunk || chunk.length < chunkSize) break;
        }
      } else {
        // Try Polar data if no Garmin data
        console.log('🔍 DEBUG: No Garmin data found, trying Polar data');
        dataSource = 'polar';
        
        const { count: polarCount, error: polarCountError } = await supabase
          .from('polar_activity_details')
          .select('*', { count: 'exact', head: true })
          .eq('activity_id', id)
          .not('total_distance_in_meters', 'is', null);

        if (polarCountError) throw polarCountError;
        console.log('🔍 DEBUG: Polar records count:', polarCount);

        if (polarCount && polarCount > 0) {
          // Fetch Polar data in chunks
          const chunkSize = 1000;
          let currentOffset = 0;
          
          while (currentOffset < polarCount) {
            const { data: chunk, error: chunkError } = await supabase
              .from('polar_activity_details')
              .select('heart_rate, speed_meters_per_second, total_distance_in_meters, samples, sample_timestamp')
              .eq('activity_id', id)
              .not('total_distance_in_meters', 'is', null)
              .order('total_distance_in_meters', { ascending: true })
              .range(currentOffset, currentOffset + chunkSize - 1);

            if (chunkError) throw chunkError;
            
            if (chunk && chunk.length > 0) {
              allDetails.push(...chunk);
              console.log(`🔍 DEBUG: Fetched Polar chunk ${currentOffset}-${currentOffset + chunk.length - 1}, total so far: ${allDetails.length}`);
            }
            
            currentOffset += chunkSize;
            
            // Break if we got less than expected (end of data)
            if (!chunk || chunk.length < chunkSize) break;
          }
        } else {
          // Try Zepp GPX data if no Polar data
          console.log('🔍 DEBUG: No Polar data found, trying Zepp GPX details');
          dataSource = 'zepp_gpx';

          const { count: zeppCount, error: zeppCountError } = await supabase
            .from('zepp_gpx_activity_details')
            .select('*', { count: 'exact', head: true })
            .eq('activity_id', id)
            .not('total_distance_in_meters', 'is', null);

          if (zeppCountError) throw zeppCountError;
          console.log('🔍 DEBUG: Zepp GPX records count:', zeppCount);

          if (zeppCount && zeppCount > 0) {
            const chunkSize = 1000;
            let currentOffset = 0;

            while (currentOffset < zeppCount) {
              const { data: chunk, error: chunkError } = await supabase
                .from('zepp_gpx_activity_details')
                .select('heart_rate, speed_meters_per_second, total_distance_in_meters, sample_timestamp')
                .eq('activity_id', id)
                .not('total_distance_in_meters', 'is', null)
                .order('sample_timestamp', { ascending: true })
                .range(currentOffset, currentOffset + chunkSize - 1);

              if (chunkError) throw chunkError;

              if (chunk && chunk.length > 0) {
                allDetails.push(...chunk);
                console.log(`🔍 DEBUG: Fetched Zepp GPX chunk ${currentOffset}-${currentOffset + chunk.length - 1}, total so far: ${allDetails.length}`);
              }

              currentOffset += chunkSize;

              if (!chunk || chunk.length < chunkSize) break;
            }
          } else {
            // Final fallback to Strava GPX data
            console.log('🔍 DEBUG: No Zepp GPX data found, trying Strava GPX details');
            
            // First, check if this is a Strava GPX activity and get the correct activity_id
            const { data: stravaGpxActivity, error: stravaGpxActivityErr } = await supabase
              .from('strava_gpx_activities')
              .select('activity_id')
              .eq('id', id)
              .maybeSingle();
            
            let stravaGpxActivityId = id; // Default to the passed ID
            if (!stravaGpxActivityErr && stravaGpxActivity) {
              stravaGpxActivityId = stravaGpxActivity.activity_id;
              console.log(`🔍 DEBUG: Found Strava GPX activity, using activity_id: ${stravaGpxActivityId}`);
            }

            dataSource = 'strava_gpx';

            const { count: gpxCount, error: gpxCountError } = await supabase
              .from('strava_gpx_activity_details')
              .select('*', { count: 'exact', head: true })
              .eq('activity_id', stravaGpxActivityId)
              .not('total_distance_in_meters', 'is', null);

            if (gpxCountError) throw gpxCountError;
            console.log('🔍 DEBUG: Strava GPX records count:', gpxCount);

            if (gpxCount && gpxCount > 0) {
              const chunkSize = 1000;
              let currentOffset = 0;

              while (currentOffset < gpxCount) {
                const { data: chunk, error: chunkError } = await supabase
                  .from('strava_gpx_activity_details')
                  .select('heart_rate, speed_meters_per_second, total_distance_in_meters, sample_timestamp')
                  .eq('activity_id', stravaGpxActivityId)
                  .not('total_distance_in_meters', 'is', null)
                  .order('sample_timestamp', { ascending: true })
                  .range(currentOffset, currentOffset + chunkSize - 1);

                if (chunkError) throw chunkError;

                if (chunk && chunk.length > 0) {
                  allDetails.push(...chunk);
                  console.log(`🔍 DEBUG: Fetched Strava GPX chunk ${currentOffset}-${currentOffset + chunk.length - 1}, total so far: ${allDetails.length}`);
                }

                currentOffset += chunkSize;

                if (!chunk || chunk.length < chunkSize) break;
              }
            }
          }
        }
      }
      
      // If GPX data source and speeds are missing, compute speeds from distance/time
      if ((dataSource === 'strava_gpx' || dataSource === 'zepp_gpx') && allDetails.length > 1) {
        console.log('🔍 DEBUG: Computing speeds from distance/time for GPX data');
        // Ensure chronological order
        allDetails.sort((a: any, b: any) => new Date(a.sample_timestamp).getTime() - new Date(b.sample_timestamp).getTime());
        let speedCalculations = 0;
        for (let i = 1; i < allDetails.length; i++) {
          const prev: any = allDetails[i - 1];
          const cur: any = allDetails[i];
          const tPrev = new Date(prev.sample_timestamp).getTime();
          const tCur = new Date(cur.sample_timestamp).getTime();
          const dt = (tCur - tPrev) / 1000; // seconds
          const dPrev = Number(prev.total_distance_in_meters || 0);
          const dCur = Number(cur.total_distance_in_meters || 0);
          const dd = dCur - dPrev;
          const sp = dt > 0 && dd >= 0 ? dd / dt : 0;
          if (!cur.speed_meters_per_second || cur.speed_meters_per_second <= 0) {
            cur.speed_meters_per_second = sp;
            speedCalculations++;
          }
        }
        console.log(`🔍 DEBUG: Calculated speed for ${speedCalculations} records`);
      }
      
      setHasRawData(allDetails.length > 0);
      console.log(`🔍 DEBUG: Using ${dataSource} data source with ${allDetails.length} total records`);
      
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
        
        // Log some sample pace calculations for debugging
        if (index < 5) {
          console.log(`🔍 DEBUG: Sample ${index}: speed=${sample.speed_meters_per_second}, pace=${pace_min_per_km}, distance=${sample.total_distance_in_meters}`);
        }
        
        return {
          distance: sample.total_distance_in_meters! / 1000,
          heart_rate: sample.heart_rate!,
          pace: pace_min_per_km,
          speed: sample.speed_meters_per_second || 0
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
        item.heart_rate && item.heart_rate > 0 && item.pace !== null && item.pace && item.pace > 0
      );

      console.log('🔍 DEBUG: Valid HR records:', validHRRecords.length);
      console.log('🔍 DEBUG: Valid pace records:', validPaceRecords.length);
      console.log('🔍 DEBUG: Valid both HR+pace records:', validBothRecords.length);

      // Apply final filter - include records with valid heart rate
      const chartData = processedData
        .filter(item => {
          // Include records with valid heart rate (speed can be 0 if stopped)
          return item.heart_rate > 0;
        })
        .sort((a, b) => a.distance - b.distance);

      console.log('🔍 DEBUG: Final chart data points:', chartData.length);
      if (chartData.length > 0) {
        const maxDistanceFinal = Math.max(...chartData.map(d => d.distance_km));
        console.log('🔍 DEBUG: Max distance in final chart data:', maxDistanceFinal, 'km');
        console.log('🔍 DEBUG: First 5 chart points:', chartData.slice(0, 5));
        console.log('🔍 DEBUG: Last 5 chart points:', chartData.slice(-5));
      }

      // Check for gaps in distance
      if (chartData.length > 1) {
        const distances = chartData.map(d => d.distance).sort((a, b) => a - b);
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
      // Reset state
    }
  }, [activityId]);

  const refetch = () => {
    if (activityId) {
      fetchData(activityId);
    }
  };

  return {
    data,
    loading,
    error,
    hasData: data.length > 0,
    hasRawData,
    refetch
  };
};
