import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UnifiedActivity {
  id: string;
  activity_id: string;
  source: 'GARMIN' | 'STRAVA' | 'POLAR' | 'BIOPEAK' | 'ZEPP';
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

      // Buscar atividades importadas via GPX (Strava GPX)
      const stravaGpxQuery = supabase
        .from('strava_gpx_activities')
        .select('*')
        .eq('user_id', user.id);

      // Buscar sessões de treino do BioPeak AI Coach
      const trainingSessionsQuery = supabase
        .from('training_sessions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['completed', 'paused']);

      const [garminResult, stravaResult, polarResult, stravaGpxResult, trainingSessionsResult] = await Promise.all([
        garminQuery,
        stravaQuery, 
        polarQuery,
        stravaGpxQuery,
        trainingSessionsQuery
      ]);

      if (garminResult.error) throw garminResult.error;
      if (stravaResult.error) throw stravaResult.error;
      if (polarResult.error) throw polarResult.error;
      if (stravaGpxResult.error) throw stravaGpxResult.error;
      if (trainingSessionsResult.error) throw trainingSessionsResult.error;

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
        distance_in_meters: activity.distance || null, // Strava distance is already in meters
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
        duration_in_seconds: activity.duration ? Number(activity.duration) : null, // Duration comes in seconds from Polar
        distance_in_meters: activity.distance ? Number(activity.distance) : null, // Distance comes in meters from Polar
        average_pace_in_minutes_per_kilometer: activity.distance && activity.duration ? 
          ((Number(activity.duration) / 60) / (Number(activity.distance) / 1000)) : null, // Calculate pace from distance and duration
        average_heart_rate_in_beats_per_minute: activity.average_heart_rate_bpm || null,
        max_heart_rate_in_beats_per_minute: activity.maximum_heart_rate_bpm || null,
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

      // Normalizar dados do Strava GPX
      const stravaGpxActivities: UnifiedActivity[] = (stravaGpxResult.data || []).map((a: any) => ({
        id: a.id,
        activity_id: a.activity_id,
        source: 'STRAVA' as const,
        activity_type: a.activity_type,
        activity_date: a.activity_date,
        duration_in_seconds: a.duration_in_seconds,
        distance_in_meters: a.distance_in_meters,
        average_pace_in_minutes_per_kilometer: a.average_pace_in_minutes_per_kilometer,
        average_heart_rate_in_beats_per_minute: a.average_heart_rate,
        max_heart_rate_in_beats_per_minute: a.max_heart_rate,
        active_kilocalories: a.calories,
        total_elevation_gain_in_meters: a.total_elevation_gain_in_meters,
        total_elevation_loss_in_meters: a.total_elevation_loss_in_meters,
        device_name: 'Strava GPX',
        start_time_in_seconds: a.start_time ? Math.floor(new Date(a.start_time).getTime() / 1000) : null,
        start_time_offset_in_seconds: null,
        average_speed_in_meters_per_second: a.average_speed_in_meters_per_second,
        max_speed_in_meters_per_second: null,
        steps: null,
        synced_at: a.synced_at,
        name: a.name
      }));

      // Buscar atividades GPX da Zepp
      const zeppGpxResult = await supabase
        .from('zepp_gpx_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false });

      if (zeppGpxResult.error) {
        console.error('Error fetching Zepp GPX activities:', zeppGpxResult.error);
      }

      // Normalizar dados das atividades GPX da Zepp
      const zeppGpxActivities: UnifiedActivity[] = (zeppGpxResult.data || []).map(a => ({
        id: a.id,
        source: 'ZEPP' as const,
        activity_id: a.activity_id,
        summary_id: null,
        user_id: a.user_id,
        activity_type: a.activity_type,
        activity_date: a.start_time ? new Date(a.start_time).toISOString().split('T')[0] : null,
        duration_in_seconds: a.duration_in_seconds,
        distance_in_meters: a.distance_in_meters,
        average_pace_in_minutes_per_kilometer: a.average_pace_min_km,
        average_heart_rate_in_beats_per_minute: a.average_heart_rate,
        max_heart_rate_in_beats_per_minute: a.max_heart_rate,
        active_kilocalories: a.calories,
        total_elevation_gain_in_meters: a.elevation_gain_meters,
        total_elevation_loss_in_meters: a.elevation_loss_meters,
        device_name: 'Zepp GPX',
        start_time_in_seconds: a.start_time ? Math.floor(new Date(a.start_time).getTime() / 1000) : null,
        start_time_offset_in_seconds: null,
        average_speed_in_meters_per_second: a.average_speed_ms,
        max_speed_in_meters_per_second: a.max_speed_ms,
        steps: null,
        synced_at: a.created_at,
        name: a.name
      }));

      // Normalizar dados das sessões de treino do BioPeak AI Coach
      const trainingSessionActivities: UnifiedActivity[] = (trainingSessionsResult.data || []).map(session => ({
        id: session.id,
        activity_id: session.id,
        source: 'BIOPEAK' as const,
        activity_type: session.session_type || 'RUNNING',
        activity_date: session.created_at ? new Date(session.created_at).toISOString().split('T')[0] : null,
        duration_in_seconds: session.total_duration_seconds || null,
        distance_in_meters: session.total_distance_meters || null,
        average_pace_in_minutes_per_kilometer: session.average_pace_min_km || null,
        average_heart_rate_in_beats_per_minute: session.average_heart_rate || null,
        max_heart_rate_in_beats_per_minute: null,
        active_kilocalories: session.calories_burned || null,
        total_elevation_gain_in_meters: null,
        total_elevation_loss_in_meters: null,
        device_name: 'BioPeak AI Coach',
        start_time_in_seconds: session.created_at ? Math.floor(new Date(session.created_at).getTime() / 1000) : null,
        start_time_offset_in_seconds: null,
        average_speed_in_meters_per_second: null,
        max_speed_in_meters_per_second: null,
        steps: null,
        synced_at: session.created_at,
        name: 'Treino BioPeak AI Coach'
      }));

      // Combinar todas as atividades e ordenar por data
      const allActivities = [...garminActivities, ...stravaActivities, ...polarActivities, ...stravaGpxActivities, ...zeppGpxActivities, ...trainingSessionActivities];
      
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
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar histórico';
      
      // Evitar loop infinito de requisições em caso de erro de rede
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        console.warn('Network error detected, setting empty activities to prevent loop');
        setActivities([]);
      }
      
      setError(errorMessage);
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
    const sourceLabel = activity.device_name === 'Strava GPX' 
      ? 'Strava GPX' 
      : activity.device_name === 'Zepp GPX'
      ? 'Zepp GPX'
      : (activity.source === 'BIOPEAK' ? 'BioPeak AI Coach' : activity.source);
    return `${date} - ${type} ${distance} ${duration} [${sourceLabel}]`.trim();
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