import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Activity {
  id: string;
  summary_id: string;
  activity_id: string;
  activity_type: string | null;
  activity_date: string | null;
  duration_in_seconds: number | null;
  distance_in_meters: number | null;
  average_pace_in_minutes_per_kilometer: number | null;
  average_heart_rate_in_beats_per_minute: number | null;
  max_heart_rate_in_beats_per_minute: number | null;
  active_kilocalories: number | null;
  total_elevation_gain_in_meters: number | null;
  total_elevation_loss_in_meters: number | null;
  device_name: string | null;
  start_time_in_seconds: number | null;
  start_time_offset_in_seconds: number | null;
  average_speed_in_meters_per_second: number | null;
  max_speed_in_meters_per_second: number | null;
  steps: number | null;
  synced_at: string;
}

export function useActivityHistory(limit: number = 50) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setActivities([]);
      setLoading(false);
      return;
    }

    fetchActivities();
  }, [user, limit]);

  const fetchActivities = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('garmin_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('activity_date', { ascending: false })
        .limit(limit);

      if (fetchError) {
        throw fetchError;
      }

      setActivities(data || []);
    } catch (err) {
      console.error('Error fetching activity history:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const getActivityById = (activityId: string): Activity | undefined => {
    return activities.find(activity => activity.id === activityId);
  };

  const formatActivityDisplay = (activity: Activity): string => {
    const date = activity.activity_date ? new Date(activity.activity_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data N/A';
    const type = getActivityTypeLabel(activity.activity_type);
    const distance = activity.distance_in_meters ? `${(activity.distance_in_meters / 1000).toFixed(1)}km` : '';
    const duration = activity.duration_in_seconds ? formatDuration(activity.duration_in_seconds) : '';
    
    return `${date} - ${type} ${distance} ${duration}`.trim();
  };

  const getActivityTypeLabel = (type: string | null): string => {
    if (!type) return 'Atividade';
    const typeMap: { [key: string]: string } = {
      'RUNNING': 'Corrida',
      'CYCLING': 'Ciclismo', 
      'WALKING': 'Caminhada',
      'SWIMMING': 'Natação',
      'FITNESS_EQUIPMENT': 'Academia'
    };
    return typeMap[type.toUpperCase()] || type;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h${minutes}m`;
    }
    return `${minutes}m`;
  };

  return {
    activities,
    loading,
    error,
    getActivityById,
    formatActivityDisplay,
    getActivityTypeLabel,
    refetch: fetchActivities
  };
}