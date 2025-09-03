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
      console.log('🔍 GPS DATA FETCH: No activityId provided');
      setGpsData(null);
      return;
    }

    const fetchGPSData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔍 GPS DATA FETCH: Starting for activity ID:', activityId);
        
        // First, get the actual activity_id from all_activities table
        const { data: activityData, error: activityError } = await supabase
          .from('all_activities')
          .select('activity_id, activity_source')
          .eq('id', activityId)
          .maybeSingle();

        console.log('🔍 GPS DATA FETCH: Activity data:', activityData, 'Error:', activityError);

        if (activityError) {
          console.error('🔍 GPS DATA FETCH: Error fetching activity data:', activityError);
          throw activityError;
        }

        if (!activityData?.activity_id) {
          console.log('🔍 GPS DATA FETCH: No activity_id found for UUID:', activityId);
          setGpsData(null);
          return;
        }

        console.log('🔍 GPS DATA FETCH: Looking for coordinates with activity_id:', activityData.activity_id, 'from source:', activityData.activity_source);

        // Now fetch GPS coordinates using the real activity_id
        const { data: coordinatesData, error: fetchError } = await supabase
          .from('activity_coordinates')
          .select('coordinates, starting_latitude, starting_longitude')
          .eq('activity_id', activityData.activity_id)
          .not('coordinates', 'is', null)
          .maybeSingle();

        console.log('🔍 GPS DATA FETCH: Coordinates query result:', {
          found: !!coordinatesData,
          hasCoordinates: coordinatesData?.coordinates ? Array.isArray(coordinatesData.coordinates) : false,
          coordinatesLength: coordinatesData?.coordinates ? coordinatesData.coordinates.length : 0,
          error: fetchError
        });

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            // No GPS data found for this activity
            console.log('🔍 GPS DATA FETCH: No GPS coordinates found in database');
            setGpsData(null);
          } else {
            console.error('🔍 GPS DATA FETCH: Error fetching coordinates:', fetchError);
            throw fetchError;
          }
          return;
        }

        if (coordinatesData && coordinatesData.coordinates) {
          console.log('🔍 GPS DATA FETCH: Processing coordinates data');
          const processedData = processGPSData([coordinatesData]);
          console.log('🔍 GPS DATA FETCH: Processed data:', {
            coordinatesCount: processedData.coordinates.length,
            hasBounds: !!processedData.bounds
          });
          setGpsData(processedData);
        } else {
          console.log('🔍 GPS DATA FETCH: No coordinates data to process');
          setGpsData(null);
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