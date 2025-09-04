import { useState, useEffect } from 'react';
import { useActivityDetailsChart } from './useActivityDetailsChart';

interface PacePoint {
  coordinates: [number, number]; // [lat, lng]
  pace_min_per_km: number;
  distance_km: number;
  heart_rate?: number;
}

interface UseActivityPaceDataReturn {
  paceData: PacePoint[] | null;
  loading: boolean;
  error: string | null;
}

export const useActivityPaceData = (activityId: string | null): UseActivityPaceDataReturn => {
  const { data: chartData, loading: chartLoading, error: chartError } = useActivityDetailsChart(activityId);
  const [paceData, setPaceData] = useState<PacePoint[] | null>(null);
  const [gpsData, setGpsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.log('🔍 USE_ACTIVITY_PACE_DATA:', {
    activityId,
    hasChartData: !!chartData,
    chartDataLength: chartData?.length || 0,
    chartLoading,
    chartError,
    hasPaceData: !!paceData,
    paceDataLength: paceData?.length || 0,
    hasGpsData: !!gpsData,
    gpsDataLength: gpsData?.length || 0
  });

  // Fetch GPS coordinates data
  useEffect(() => {
    if (!activityId) {
      setGpsData([]);
      return;
    }

    const fetchGPSData = async () => {
      console.log('🔍 FETCHING GPS DATA FOR:', activityId);
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: coordinatesData, error: fetchError } = await supabase
          .from('activity_coordinates')
          .select('coordinates')
          .eq('activity_id', activityId)
          .not('coordinates', 'is', null)
          .single();

        console.log('🔍 GPS DATA RESULT:', {
          coordinatesData,
          fetchError,
          hasCoordinates: !!coordinatesData?.coordinates
        });

        if (fetchError) {
          if (fetchError.code !== 'PGRST116') {
            console.error('Error fetching GPS data:', fetchError);
          }
          setGpsData([]);
          return;
        }

        if (coordinatesData?.coordinates && Array.isArray(coordinatesData.coordinates)) {
          console.log('🔍 GPS COORDINATES COUNT:', coordinatesData.coordinates.length);
          setGpsData(coordinatesData.coordinates);
        } else {
          setGpsData([]);
        }
      } catch (err) {
        console.error('Error fetching GPS data:', err);
        setGpsData([]);
      }
    };

    fetchGPSData();
  }, [activityId]);

  // Combine chart data with GPS data
  useEffect(() => {
    setLoading(chartLoading);
    setError(chartError);

    if (!chartData?.length || !gpsData?.length) {
      setPaceData(null);
      return;
    }

    try {
      // Process GPS coordinates to normalize format
      const processedCoordinates = gpsData.map((coord: any) => {
        if (Array.isArray(coord) && coord.length === 2 && 
            typeof coord[0] === 'number' && typeof coord[1] === 'number') {
          // Garmin format: [lat, lng]
          return [coord[0], coord[1]];
        } else if (coord && typeof coord === 'object' && 
                   typeof coord.lat === 'number' && typeof coord.lon === 'number') {
          // Strava format: {lat, lon}
          return [coord.lat, coord.lon];
        }
        return null;
      }).filter(Boolean);

      if (processedCoordinates.length === 0) {
        setPaceData(null);
        return;
      }

      // Match chart data points with GPS coordinates
      const combinedData: PacePoint[] = [];
      
      chartData.forEach((point, index) => {
        // Only include points with valid pace data
        if (point.pace_min_per_km && point.pace_min_per_km > 0) {
          // Find closest GPS coordinate based on distance or use index-based matching
          let coordIndex = index;
          
          // If we have fewer GPS points than chart points, scale the index
          if (processedCoordinates.length < chartData.length) {
            coordIndex = Math.floor((index / chartData.length) * processedCoordinates.length);
          }
          
          // Ensure we don't exceed array bounds
          coordIndex = Math.min(coordIndex, processedCoordinates.length - 1);
          
          const coordinates = processedCoordinates[coordIndex];
          if (coordinates) {
            combinedData.push({
              coordinates: coordinates as [number, number],
              pace_min_per_km: point.pace_min_per_km,
              distance_km: point.distance_km,
              heart_rate: point.heart_rate || undefined
            });
          }
        }
      });

      if (combinedData.length > 0) {
        // Sample data if too many points (for performance)
        const sampledData = combinedData.length > 1000 
          ? combinedData.filter((_, index) => index % Math.ceil(combinedData.length / 1000) === 0)
          : combinedData;
        
        setPaceData(sampledData);
      } else {
        setPaceData(null);
      }

    } catch (err) {
      console.error('Error processing pace data:', err);
      setError('Erro ao processar dados de pace');
      setPaceData(null);
    }
  }, [chartData, gpsData, chartLoading, chartError]);

  return {
    paceData,
    loading,
    error
  };
};