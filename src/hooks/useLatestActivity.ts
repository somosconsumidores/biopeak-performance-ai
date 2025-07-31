import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface GarminActivity {
  id: string;
  summary_id: string;
  activity_id: string;
  activity_date: string | null;
  activity_type: string | null;
  duration_in_seconds: number | null;
  distance_in_meters: number | null;
  active_kilocalories: number | null;
  average_heart_rate_in_beats_per_minute: number | null;
  max_heart_rate_in_beats_per_minute: number | null;
  average_speed_in_meters_per_second: number | null;
  average_pace_in_minutes_per_kilometer: number | null;
  total_elevation_gain_in_meters: number | null;
  start_time_in_seconds: number | null;
  device_name: string | null;
  coordinates?: Array<{ latitude: number; longitude: number }>;
}

export const useLatestActivity = () => {
  const [activity, setActivity] = useState<GarminActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchLatestActivity = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // First get the latest activity
        const { data: activityData, error: activityError } = await supabase
          .from('garmin_activities')
          .select(`
            id,
            summary_id,
            activity_id,
            activity_date,
            activity_type,
            duration_in_seconds,
            distance_in_meters,
            active_kilocalories,
            average_heart_rate_in_beats_per_minute,
            max_heart_rate_in_beats_per_minute,
            average_speed_in_meters_per_second,
            average_pace_in_minutes_per_kilometer,
            total_elevation_gain_in_meters,
            start_time_in_seconds,
            device_name
          `)
          .eq('user_id', user.id)
          .order('start_time_in_seconds', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activityError) {
          throw activityError;
        }

        if (!activityData) {
          setActivity(null);
          return;
        }

        // Get GPS coordinates for this activity
        const { data: coordinatesData, error: coordinatesError } = await supabase
          .from('garmin_activity_details')
          .select('latitude_in_degree, longitude_in_degree')
          .eq('user_id', user.id)
          .eq('activity_id', activityData.activity_id)
          .not('latitude_in_degree', 'is', null)
          .not('longitude_in_degree', 'is', null)
          .order('sample_timestamp', { ascending: true });

        if (coordinatesError) {
          console.error('Error fetching coordinates:', coordinatesError);
        }

        // Process coordinates - sample every 10th point for performance
        const coordinates = coordinatesData?.filter((_, index) => index % 10 === 0).map(coord => ({
          latitude: coord.latitude_in_degree!,
          longitude: coord.longitude_in_degree!
        })) || [];

        // Combine activity data with coordinates
        const activityWithCoordinates: GarminActivity = {
          ...activityData,
          coordinates
        };

        setActivity(activityWithCoordinates);
      } catch (err) {
        console.error('Error fetching latest activity:', err);
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar a última atividade';
        
        // Evitar loop infinito de requisições em caso de erro de rede
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
          console.warn('Network error detected in latest activity, setting null to prevent loop');
          setActivity(null);
        }
        
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestActivity();
  }, [user]);

  return { activity, loading, error };
};