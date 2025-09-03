import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GPSData {
  coordinates: Array<[number, number]>;
  intensity: number[];
  bounds: [[number, number], [number, number]];
}

export const useActivityGPSData = (activityId: string | null) => {
  const [gpsData, setGpsData] = useState<GPSData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activityId) {
      setGpsData(null);
      return;
    }

    const fetchGPSData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch GPS coordinates for specific activity
        const { data: coordinatesData, error: fetchError } = await supabase
          .from('activity_coordinates')
          .select('coordinates, starting_latitude, starting_longitude')
          .eq('activity_id', activityId)
          .not('coordinates', 'is', null)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            // No GPS data found for this activity
            setGpsData(null);
          } else {
            throw fetchError;
          }
          return;
        }

        if (coordinatesData) {
          const processedData = processGPSData([coordinatesData]);
          setGpsData(processedData);
        }

      } catch (err: any) {
        console.error('Error fetching GPS data:', err);
        setError(err.message || 'Erro ao carregar dados GPS');
      } finally {
        setLoading(false);
      }
    };

    fetchGPSData();
  }, [activityId]);

  return { gpsData, loading, error };
};

function processGPSData(coordinatesData: any[]): GPSData {
  const allCoordinates: Array<[number, number]> = [];
  const intensity: number[] = [];

  coordinatesData.forEach(item => {
    if (item.coordinates && Array.isArray(item.coordinates)) {
      item.coordinates.forEach((coord: any) => {
        // Coordinates are stored as arrays [lat, lng]
        if (Array.isArray(coord) && coord.length === 2 && 
            typeof coord[0] === 'number' && typeof coord[1] === 'number') {
          allCoordinates.push([coord[0], coord[1]]);
          intensity.push(Math.random()); // Mock intensity - could be based on pace/HR
        }
      });
    }
  });

  if (allCoordinates.length === 0) {
    return {
      coordinates: [],
      intensity: [],
      bounds: [[-23.5505, -46.6333], [-23.5505, -46.6333]] // Default São Paulo bounds
    };
  }

  const lats = allCoordinates.map(coord => coord[0]);
  const lngs = allCoordinates.map(coord => coord[1]);
  
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)]
  ];

  return {
    coordinates: allCoordinates,
    intensity,
    bounds
  };
}