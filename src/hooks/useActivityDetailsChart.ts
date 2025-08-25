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

  // NEW: Fetch from activity_chart_data (prioritized for Garmin and Strava)
  const fetchFromActivityChartData = async (id: string): Promise<HeartRatePaceData[] | null> => {
    try {
      console.log('🔍 Fetching from activity_chart_data for activity:', id);
      
      const { data: chartData, error } = await supabase
        .from('activity_chart_data')
        .select('series_data, activity_source, data_points_count')
        .eq('activity_id', id)
        .single();

      if (error) {
        console.log('❌ No data in activity_chart_data:', error.message);
        return null;
      }

      if (!chartData || !chartData.series_data || !Array.isArray(chartData.series_data)) {
        console.log('❌ Invalid series_data in activity_chart_data');
        return null;
      }

      console.log(`✅ Found ${chartData.data_points_count} data points from activity_chart_data (${chartData.activity_source})`);

      // Transform series_data to HeartRatePaceData format
      const processedData: HeartRatePaceData[] = chartData.series_data.map((point: any) => {
        let distance_km = 0;
        let heart_rate = point.heart_rate || point.hr || 0;
        let pace_min_per_km = null;
        let speed_meters_per_second = 0;

        // Handle distance
        if (point.distance_km !== undefined) {
          distance_km = point.distance_km;
        } else if (point.distance_meters !== undefined) {
          distance_km = point.distance_meters / 1000;
        } else if (point.distance !== undefined) {
          distance_km = point.distance / 1000;
        }

        // Handle speed and pace
        if (point.speed_ms !== undefined && point.speed_ms > 0) {
          speed_meters_per_second = point.speed_ms;
          pace_min_per_km = (1000 / speed_meters_per_second) / 60;
        } else if (point.pace_min_km !== undefined && point.pace_min_km > 0) {
          pace_min_per_km = point.pace_min_km;
          speed_meters_per_second = 1000 / (pace_min_per_km * 60);
        }

        return {
          distance_km,
          heart_rate,
          pace_min_per_km,
          speed_meters_per_second
        };
      });

      return processedData.filter(item => item.heart_rate > 0);
    } catch (err) {
      console.error('❌ Error fetching from activity_chart_data:', err);
      return null;
    }
  };

  // Cache approach (existing logic)
  const tryCacheThenMaybeBuild = async (id: string): Promise<boolean> => {
    console.log('⚡ Cache: trying to load chart cache for', id);
    // Try to get any source cached for this activity_id (RLS ensures only current user)
    const { data: cached, error: cacheErr } = await supabase
      .from('activity_chart_cache')
      .select('series, build_status, activity_source')
      .eq('activity_id', id)
      .eq('version', 1)
      .order('built_at', { ascending: false })
      .limit(1);
    if (cacheErr) {
      console.warn('⚠️ Cache load error:', cacheErr.message);
    }
    const cacheRow = cached?.[0];
    if (cacheRow && cacheRow.build_status === 'ready' && Array.isArray(cacheRow.series) && cacheRow.series.length > 0) {
      console.log('✅ Using cached series from source:', cacheRow.activity_source, 'points:', cacheRow.series.length);
      const mapped: HeartRatePaceData[] = cacheRow.series.map((p: any) => ({
        distance_km: Number(p.distance_km || 0),
        heart_rate: Number(p.heart_rate || 0),
        pace_min_per_km: typeof p.pace_min_per_km === 'number' ? p.pace_min_per_km : null,
        speed_meters_per_second: Number(p.speed_meters_per_second || 0),
      }));
      setHasRawData(mapped.length > 0);
      setData(mapped);
      return true;
    }

    // Trigger builder once (auto-detect source), then recheck quickly
    console.log('🛠️ No ready cache; invoking builder...');
    const { error: fnErr } = await supabase.functions.invoke('build-activity-chart-cache', {
      body: { activity_id: id, version: 1 },
    });
    if (fnErr) {
      console.warn('⚠️ Builder invocation error:', fnErr.message || fnErr);
    }

    // Short wait then recheck cache quickly
    await new Promise((r) => setTimeout(r, 1200));
    const { data: cached2 } = await supabase
      .from('activity_chart_cache')
      .select('series, build_status, activity_source')
      .eq('activity_id', id)
      .eq('version', 1)
      .order('built_at', { ascending: false })
      .limit(1);

    const cacheRow2 = cached2?.[0];
    if (cacheRow2 && cacheRow2.build_status === 'ready' && Array.isArray(cacheRow2.series) && cacheRow2.series.length > 0) {
      console.log('✅ Using freshly built cache from source:', cacheRow2.activity_source, 'points:', cacheRow2.series.length);
      const mapped: HeartRatePaceData[] = cacheRow2.series.map((p: any) => ({
        distance_km: Number(p.distance_km || 0),
        heart_rate: Number(p.heart_rate || 0),
        pace_min_per_km: typeof p.pace_min_per_km === 'number' ? p.pace_min_per_km : null,
        speed_meters_per_second: Number(p.speed_meters_per_second || 0),
      }));
      setHasRawData(mapped.length > 0);
      setData(mapped);
      return true;
    }

    console.log('↩️ Cache not ready; will fallback to legacy client-side processing');
    return false;
  };

  const fetchData = async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // PRIORITY 1: Try activity_chart_data first (new unified approach for Garmin and Strava)
      console.log('🔄 Starting activity chart data fetch for:', id);
      
      let chartData = await fetchFromActivityChartData(id);
      
      if (chartData && chartData.length > 0) {
        console.log('✅ Using activity_chart_data - no fallback needed');
        setData(chartData);
        setHasRawData(true);
        setLoading(false);
        return;
      }

      // PRIORITY 2: Try cache approach (existing logic)
      const cacheHit = await tryCacheThenMaybeBuild(id);
      if (cacheHit) {
        setLoading(false);
        return;
      }

      // PRIORITY 3: Fallback to legacy data sources (Polar, Zepp GPX, Strava GPX only)
      console.log('🔍 DEBUG: Fallback to legacy data sources for activity ID:', id);
      
      let allDetails = [];
      let dataSource = 'polar';
      
      // Try Polar data
      console.log('🔍 DEBUG: Trying Polar data');
      
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

      // Filter for records with heart rate
      const details = allDetails.filter(record => record.heart_rate !== null && record.heart_rate > 0);
      console.log('🔍 DEBUG: Records after HR filter:', details.length);
      
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

      // Apply final filter - include records with valid heart rate
      const finalData = processedData
        .filter(item => item.heart_rate > 0)
        .sort((a, b) => a.distance_km - b.distance_km);

      console.log('🔍 DEBUG: Final chart data points:', finalData.length);
      
      setData(finalData);
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