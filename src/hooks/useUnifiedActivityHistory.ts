import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UnifiedActivity {
  id: string;
  activity_id: string;
  source: 'GARMIN' | 'STRAVA' | 'POLAR';
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
  // Campos específicos do Strava
  strava_activity_id?: number;
  name?: string;
  // Campos específicos do Polar  
  polar_user?: string;
  detailed_sport_info?: string;
}

export function useUnifiedActivityHistory(limit?: number) {
  const [activities, setActivities] = useState<UnifiedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setActivities([]);
      setLoading(false);
      return;
    }

    fetchUnifiedActivities();
  }, [user, limit]);

  const fetchUnifiedActivities = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Buscar atividades do Garmin
      const garminQuery = supabase
        .from('garmin_activities')
        .select('*')
        .eq('user_id', user.id);

      // Buscar atividades do Strava  
      const stravaQuery = supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id);

      // Buscar atividades do Polar
      const polarQuery = supabase
        .from('polar_activities')
        .select('*')
        .eq('user_id', user.id);

      const [garminResult, stravaResult, polarResult] = await Promise.all([
        garminQuery,
        stravaQuery, 
        polarQuery
      ]);

      if (garminResult.error) throw garminResult.error;
      if (stravaResult.error) throw stravaResult.error;
      if (polarResult.error) throw polarResult.error;

      // Normalizar dados do Garmin
      const garminActivities: UnifiedActivity[] = (garminResult.data || []).map(activity => ({
        ...activity,
        source: 'GARMIN' as const,
        device_name: activity.device_name || 'Garmin Device'
      }));

      // Normalizar dados do Strava
      const stravaActivities: UnifiedActivity[] = (stravaResult.data || []).map(activity => ({
        id: activity.id,
        activity_id: activity.strava_activity_id.toString(),
        source: 'STRAVA' as const,
        activity_type: activity.type,
        activity_date: activity.start_date ? new Date(activity.start_date).toISOString().split('T')[0] : null,
        duration_in_seconds: activity.elapsed_time || activity.moving_time,
        distance_in_meters: activity.distance ? activity.distance * 1000 : null, // Strava distance is in km
        average_pace_in_minutes_per_kilometer: activity.average_speed ? 
          (1000 / (activity.average_speed * 60)) : null, // Convert from m/s to min/km
        average_heart_rate_in_beats_per_minute: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
        max_heart_rate_in_beats_per_minute: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
        active_kilocalories: activity.calories ? Math.round(activity.calories) : null,
        total_elevation_gain_in_meters: activity.total_elevation_gain || null,
        total_elevation_loss_in_meters: null,
        device_name: 'STRAVA',
        start_time_in_seconds: activity.start_date ? Math.floor(new Date(activity.start_date).getTime() / 1000) : null,
        start_time_offset_in_seconds: null,
        average_speed_in_meters_per_second: activity.average_speed || null,
        max_speed_in_meters_per_second: activity.max_speed || null,
        steps: null,
        synced_at: activity.created_at,
        strava_activity_id: activity.strava_activity_id,
        name: activity.name
      }));

      // Normalizar dados do Polar
      const polarActivities: UnifiedActivity[] = (polarResult.data || []).map(activity => ({
        id: activity.id,
        activity_id: activity.activity_id,
        source: 'POLAR' as const,
        activity_type: activity.sport || activity.activity_type,
        activity_date: activity.start_time ? new Date(activity.start_time).toISOString().split('T')[0] : null,
        duration_in_seconds: activity.duration ? parsePolarDuration(activity.duration) : null,
        distance_in_meters: activity.distance ? Number(activity.distance) * 1000 : null, // Polar distance is in km
        average_pace_in_minutes_per_kilometer: null, // Não disponível diretamente no Polar
        average_heart_rate_in_beats_per_minute: null, // Não disponível diretamente no Polar
        max_heart_rate_in_beats_per_minute: null,
        active_kilocalories: activity.calories || null,
        total_elevation_gain_in_meters: null,
        total_elevation_loss_in_meters: null,
        device_name: 'POLAR',
        start_time_in_seconds: activity.start_time ? Math.floor(new Date(activity.start_time).getTime() / 1000) : null,
        start_time_offset_in_seconds: activity.start_time_utc_offset || null,
        average_speed_in_meters_per_second: null,
        max_speed_in_meters_per_second: null,
        steps: null,
        synced_at: activity.synced_at,
        polar_user: activity.polar_user,
        detailed_sport_info: activity.detailed_sport_info
      }));

      // Combinar todas as atividades e ordenar por data
      const allActivities = [...garminActivities, ...stravaActivities, ...polarActivities];
      
      // Ordenar por data mais recente primeiro
      allActivities.sort((a, b) => {
        const timeA = a.start_time_in_seconds || 0;
        const timeB = b.start_time_in_seconds || 0;
        return timeB - timeA;
      });

      // Aplicar limite se especificado
      const finalActivities = limit ? allActivities.slice(0, limit) : allActivities;

      setActivities(finalActivities);
    } catch (err) {
      console.error('Error fetching unified activity history:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const getActivityById = (activityId: string): UnifiedActivity | undefined => {
    return activities.find(activity => activity.id === activityId);
  };

  const formatActivityDisplay = (activity: UnifiedActivity): string => {
    const date = activity.activity_date ? new Date(activity.activity_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data N/A';
    const type = getActivityTypeLabel(activity.activity_type);
    const distance = activity.distance_in_meters ? `${(activity.distance_in_meters / 1000).toFixed(1)}km` : '';
    const duration = activity.duration_in_seconds ? formatDuration(activity.duration_in_seconds) : '';
    const source = activity.source;
    
    return `${date} - ${type} ${distance} ${duration} [${source}]`.trim();
  };

  const getActivityTypeLabel = (type: string | null): string => {
    if (!type) return 'Atividade';
    const typeMap: { [key: string]: string } = {
      'RUNNING': 'Corrida',
      'Run': 'Corrida',
      'running': 'Corrida',
      'CYCLING': 'Ciclismo',
      'Ride': 'Ciclismo', 
      'cycling': 'Ciclismo',
      'WALKING': 'Caminhada',
      'Walk': 'Caminhada',
      'walking': 'Caminhada',
      'SWIMMING': 'Natação',
      'Swim': 'Natação',
      'swimming': 'Natação',
      'FITNESS_EQUIPMENT': 'Academia',
      'Workout': 'Academia'
    };
    return typeMap[type] || type;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Helper function para parsear duração do Polar (formato "PT1H30M45S")
  const parsePolarDuration = (duration: string): number => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseFloat(match[3] || '0');
    
    return hours * 3600 + minutes * 60 + seconds;
  };

  return {
    activities,
    loading,
    error,
    getActivityById,
    formatActivityDisplay,
    getActivityTypeLabel,
    refetch: fetchUnifiedActivities
  };
}