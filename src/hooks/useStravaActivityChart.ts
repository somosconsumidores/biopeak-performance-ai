import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StravaChartData {
  distance_km: number;
  pace_min_per_km: number | null;
  time_seconds: number;
  heart_rate: number | null;
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

        // Fetch all rows with pagination to avoid the 1,000 row limit
        const pageSize = 1000;
        let allRows: any[] = [];
        let from = 0;
        while (true) {
          const { data: page, error: pageError } = await supabase
            .from('strava_activity_details')
            .select('distance, time_seconds, velocity_smooth, heartrate, time_index')
            .eq('strava_activity_id', stravaActivityId)
            .order('time_index', { ascending: true })
            .range(from, from + pageSize - 1);
          if (pageError) {
            console.error('Error fetching Strava activity details page:', pageError);
            throw pageError;
          }
          if (!page || page.length === 0) break;
          allRows = allRows.concat(page);
          if (page.length < pageSize) break;
          from += pageSize;
        }

        if (!allRows || allRows.length === 0) {
          console.log('No Strava activity details found for activity:', stravaActivityId);
          setData([]);
          return;
        }

        console.log(`Processing ${allRows.length} Strava data points`);

        // Process data and calculate pace with distance fallback when missing
        let prevDistance = 0;
        let prevTime: number | null = null;
        const processedData: StravaChartData[] = allRows.map((point: any) => {
          const velocityMs = point.velocity_smooth || 0;
          const timeSec: number | null = point.time_seconds ?? null;

          let distanceMeters: number = typeof point.distance === 'number' ? point.distance : prevDistance;
          if (point.distance == null && prevTime != null && timeSec != null) {
            const dt = Math.max(0, timeSec - prevTime);
            distanceMeters = prevDistance + velocityMs * dt;
          }
          prevDistance = distanceMeters;
          if (timeSec !== null) prevTime = timeSec;

          const distanceKm = (distanceMeters || 0) / 1000;
          // Calculate pace from velocity (pace = 1000 / (velocity * 60) minutes per km)
          const paceMinPerKm = velocityMs > 0 ? 1000 / (velocityMs * 60) : null;

          return {
            distance_km: distanceKm,
            pace_min_per_km: paceMinPerKm,
            time_seconds: timeSec || 0,
            heart_rate: point.heartrate ?? null,
          };
        });

        // Sanitize pace values but keep all points (to show full distance and HR)
        const sanitizedData = processedData.map(p => ({
          ...p,
          pace_min_per_km: p.pace_min_per_km && p.pace_min_per_km > 0 && p.pace_min_per_km < 20 ? p.pace_min_per_km : null,
        }));

        // Sample data for performance but ensure last point is included
        const sampledData = sanitizedData.length > 5000
          ? sanitizedData.filter((_, index) => index % 3 === 0 || index === sanitizedData.length - 1)
          : sanitizedData;

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
