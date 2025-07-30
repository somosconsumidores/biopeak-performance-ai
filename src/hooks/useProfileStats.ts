import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UnifiedActivity } from '@/hooks/useUnifiedActivityHistory';

interface ProfileStats {
  totalActivities: number;
  totalDistance: number; // em metros
  longestDistance: number; // maior distância em uma única atividade
  totalDuration: number; // em segundos
  avgHeartRate: number;
  maxHeartRate: number;
  avgPace: number; // em min/km
  bestPace: number; // em min/km
  totalCalories: number;
  avgWeeklyActivities: number;
  memberSince: string | null;
  lastActivity: string | null;
  currentStreak: number;
  vo2Max: number | null;
  restingHeartRate: number | null;
}

interface PersonalBest {
  metric: string;
  value: string;
  date: string;
  activityType: string;
}

export function useProfileStats() {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setStats(null);
      setPersonalBests([]);
      setLoading(false);
      return;
    }

    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Buscar atividades de todas as fontes
      const [garminResult, stravaResult, polarResult] = await Promise.all([
        supabase.from('garmin_activities').select('*').eq('user_id', user.id),
        supabase.from('strava_activities').select('*').eq('user_id', user.id),
        supabase.from('polar_activities').select('*').eq('user_id', user.id)
      ]);

      if (garminResult.error) throw garminResult.error;
      if (stravaResult.error) throw stravaResult.error;
      if (polarResult.error) throw polarResult.error;

      // Normalizar e unificar atividades
      const unifiedActivities = unifyActivities(
        garminResult.data || [],
        stravaResult.data || [],
        polarResult.data || []
      );

      // Remover duplicatas baseado em timestamp e duração
      const activities = deduplicateActivities(unifiedActivities);

      if (!activities || activities.length === 0) {
        setStats({
          totalActivities: 0,
          totalDistance: 0,
          longestDistance: 0,
          totalDuration: 0,
          avgHeartRate: 0,
          maxHeartRate: 0,
          avgPace: 0,
          bestPace: 0,
          totalCalories: 0,
          avgWeeklyActivities: 0,
          memberSince: null,
          lastActivity: null,
          currentStreak: 0,
          vo2Max: null,
          restingHeartRate: null
        });
        setPersonalBests([]);
        return;
      }

      // Calcular estatísticas
      const totalActivities = activities.length;
      const totalDistance = activities.reduce((sum, act) => sum + (act.distance_in_meters || 0), 0);
      const longestDistance = Math.max(...activities.map(act => act.distance_in_meters || 0));
      const totalDuration = activities.reduce((sum, act) => sum + (act.duration_in_seconds || 0), 0);
      const totalCalories = activities.reduce((sum, act) => sum + (act.active_kilocalories || 0), 0);

      // Média de FC (apenas atividades com FC registrada)
      const activitiesWithHR = activities.filter(act => act.average_heart_rate_in_beats_per_minute);
      const avgHeartRate = activitiesWithHR.length > 0 
        ? activitiesWithHR.reduce((sum, act) => sum + (act.average_heart_rate_in_beats_per_minute || 0), 0) / activitiesWithHR.length
        : 0;

      // FC máxima
      const maxHeartRate = Math.max(...activities.map(act => act.max_heart_rate_in_beats_per_minute || 0));

      // Pace médio e melhor (apenas atividades de corrida com pace registrado)
      const runningActivities = activities.filter(act => 
        act.activity_type?.toLowerCase().includes('running') || 
        act.activity_type?.toLowerCase().includes('corrida')
      );
      
      const activitiesWithPace = runningActivities.filter(act => act.average_pace_in_minutes_per_kilometer);
      const avgPace = activitiesWithPace.length > 0
        ? activitiesWithPace.reduce((sum, act) => sum + (act.average_pace_in_minutes_per_kilometer || 0), 0) / activitiesWithPace.length
        : 0;

      const bestPace = activitiesWithPace.length > 0
        ? Math.min(...activitiesWithPace.map(act => act.average_pace_in_minutes_per_kilometer || Infinity))
        : 0;

      // Data de membro (primeira atividade)
      const memberSince = activities[activities.length - 1]?.activity_date || null;
      const lastActivity = activities[0]?.activity_date || null;

      // Calcular média semanal
      const firstActivityDate = new Date(memberSince || new Date());
      const now = new Date();
      const weeksDiff = Math.max(1, (now.getTime() - firstActivityDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
      const avgWeeklyActivities = totalActivities / weeksDiff;

      // Calcular sequência atual (atividades nos últimos dias consecutivos)
      const currentStreak = calculateCurrentStreak(activities);

      const calculatedStats: ProfileStats = {
        totalActivities,
        totalDistance,
        longestDistance,
        totalDuration,
        avgHeartRate: Math.round(avgHeartRate),
        maxHeartRate,
        avgPace,
        bestPace,
        totalCalories,
        avgWeeklyActivities: Math.round(avgWeeklyActivities * 10) / 10,
        memberSince,
        lastActivity,
        currentStreak,
        vo2Max: null, // Pode ser calculado posteriormente com base em dados mais específicos
        restingHeartRate: null // Requereria dados de repouso
      };

      setStats(calculatedStats);

      // Calcular recordes pessoais
      const bests = calculatePersonalBests(activities);
      setPersonalBests(bests);

    } catch (error) {
      console.error('Error fetching profile stats:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const calculateCurrentStreak = (activities: any[]) => {
    if (activities.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let streak = 0;
    let currentDate = new Date(today);

    // Verificar se há atividade hoje ou ontem para começar a contar
    const hasRecentActivity = activities.some(act => {
      const actDate = new Date(act.activity_date);
      actDate.setHours(0, 0, 0, 0);
      const diffDays = (today.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 1;
    });

    if (!hasRecentActivity) return 0;

    // Contar dias consecutivos com atividades
    while (true) {
      const hasActivity = activities.some(act => {
        const actDate = new Date(act.activity_date);
        actDate.setHours(0, 0, 0, 0);
        return actDate.getTime() === currentDate.getTime();
      });

      if (hasActivity) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  // Função para unificar atividades de todas as fontes
  const unifyActivities = (garminData: any[], stravaData: any[], polarData: any[]): UnifiedActivity[] => {
    // Normalizar atividades do Garmin
    const garminActivities: UnifiedActivity[] = garminData.map(activity => ({
      ...activity,
      source: 'GARMIN' as const,
      device_name: activity.device_name || 'Garmin Device'
    }));

    // Normalizar atividades do Strava
    const stravaActivities: UnifiedActivity[] = stravaData.map(activity => ({
      id: activity.id,
      activity_id: activity.strava_activity_id.toString(),
      source: 'STRAVA' as const,
      activity_type: activity.type,
      activity_date: activity.start_date ? new Date(activity.start_date).toISOString().split('T')[0] : null,
      duration_in_seconds: activity.elapsed_time || activity.moving_time,
      distance_in_meters: activity.distance ? activity.distance * 1000 : null,
      average_pace_in_minutes_per_kilometer: activity.average_speed ? 
        (1000 / (activity.average_speed * 60)) : null,
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

    // Normalizar atividades do Polar
    const polarActivities: UnifiedActivity[] = polarData.map(activity => ({
      id: activity.id,
      activity_id: activity.activity_id,
      source: 'POLAR' as const,
      activity_type: activity.sport || activity.activity_type,
      activity_date: activity.start_time ? new Date(activity.start_time).toISOString().split('T')[0] : null,
      duration_in_seconds: activity.duration ? parsePolarDuration(activity.duration) : null,
      distance_in_meters: activity.distance ? Number(activity.distance) * 1000 : null,
      average_pace_in_minutes_per_kilometer: null,
      average_heart_rate_in_beats_per_minute: null,
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

    return [...garminActivities, ...stravaActivities, ...polarActivities];
  };

  // Função para remover duplicatas
  const deduplicateActivities = (activities: UnifiedActivity[]): UnifiedActivity[] => {
    const duplicates: Set<string> = new Set();
    
    return activities.filter(activity => {
      if (!activity.start_time_in_seconds || !activity.duration_in_seconds) {
        return true; // Manter atividades sem timestamp
      }

      // Criar chave única baseada em timestamp (±5 min) e duração (±30 seg)
      const timeWindow = 300; // 5 minutos
      const durationWindow = 30; // 30 segundos
      
      for (const existing of duplicates) {
        const [existingTime, existingDuration] = existing.split(':').map(Number);
        
        const timeDiff = Math.abs(activity.start_time_in_seconds - existingTime);
        const durationDiff = Math.abs(activity.duration_in_seconds - existingDuration);
        
        if (timeDiff <= timeWindow && durationDiff <= durationWindow) {
          console.log(`Atividade duplicada detectada: ${activity.source} vs existente, diff tempo: ${timeDiff}s, diff duração: ${durationDiff}s`);
          return false; // É uma duplicata
        }
      }
      
      // Adicionar à lista de atividades únicas
      duplicates.add(`${activity.start_time_in_seconds}:${activity.duration_in_seconds}`);
      return true;
    }).sort((a, b) => {
      const timeA = a.start_time_in_seconds || 0;
      const timeB = b.start_time_in_seconds || 0;
      return timeB - timeA; // Mais recente primeiro
    });
  };

  // Helper para parsear duração do Polar
  const parsePolarDuration = (duration: string): number => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseFloat(match[3] || '0');
    
    return hours * 3600 + minutes * 60 + seconds;
  };

  const calculatePersonalBests = (activities: UnifiedActivity[]): PersonalBest[] => {
    const bests: PersonalBest[] = [];

    // Melhor distância
    const longestActivity = activities.reduce((max, act) => 
      (act.distance_in_meters || 0) > (max.distance_in_meters || 0) ? act : max
    );
    if (longestActivity.distance_in_meters) {
      bests.push({
        metric: 'Maior Distância',
        value: `${(longestActivity.distance_in_meters / 1000).toFixed(1)} km`,
        date: new Date(longestActivity.activity_date + 'T00:00:00').toLocaleDateString('pt-BR'),
        activityType: longestActivity.activity_type || 'Atividade'
      });
    }

    // Melhor pace (corridas)
    const runningActivities = activities.filter(act => 
      (act.activity_type?.toLowerCase().includes('running') || 
       act.activity_type?.toLowerCase().includes('corrida')) &&
      act.average_pace_in_minutes_per_kilometer
    );
    
    if (runningActivities.length > 0) {
      const bestPaceActivity = runningActivities.reduce((best, act) => 
        (act.average_pace_in_minutes_per_kilometer || Infinity) < (best.average_pace_in_minutes_per_kilometer || Infinity) ? act : best
      );
      
      bests.push({
        metric: 'Melhor Pace',
        value: `${Math.floor(bestPaceActivity.average_pace_in_minutes_per_kilometer)}:${String(Math.round((bestPaceActivity.average_pace_in_minutes_per_kilometer % 1) * 60)).padStart(2, '0')}/km`,
        date: new Date(bestPaceActivity.activity_date + 'T00:00:00').toLocaleDateString('pt-BR'),
        activityType: bestPaceActivity.activity_type || 'Corrida'
      });
    }

    // Maior FC
    const maxHRActivity = activities.reduce((max, act) => 
      (act.max_heart_rate_in_beats_per_minute || 0) > (max.max_heart_rate_in_beats_per_minute || 0) ? act : max
    );
    if (maxHRActivity.max_heart_rate_in_beats_per_minute) {
      bests.push({
        metric: 'FC Máxima',
        value: `${maxHRActivity.max_heart_rate_in_beats_per_minute} bpm`,
        date: new Date(maxHRActivity.activity_date + 'T00:00:00').toLocaleDateString('pt-BR'),
        activityType: maxHRActivity.activity_type || 'Atividade'
      });
    }

    // Mais calorias
    const maxCaloriesActivity = activities.reduce((max, act) => 
      (act.active_kilocalories || 0) > (max.active_kilocalories || 0) ? act : max
    );
    if (maxCaloriesActivity.active_kilocalories) {
      bests.push({
        metric: 'Mais Calorias',
        value: `${maxCaloriesActivity.active_kilocalories} kcal`,
        date: new Date(maxCaloriesActivity.activity_date + 'T00:00:00').toLocaleDateString('pt-BR'),
        activityType: maxCaloriesActivity.activity_type || 'Atividade'
      });
    }

    return bests.slice(0, 4); // Retornar apenas os 4 melhores
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters} m`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatPace = (paceMinutesPerKm: number) => {
    if (paceMinutesPerKm === 0) return 'N/A';
    const minutes = Math.floor(paceMinutesPerKm);
    const seconds = Math.round((paceMinutesPerKm % 1) * 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
  };

  return {
    stats,
    personalBests,
    loading,
    error,
    refetch: fetchStats,
    formatDistance,
    formatDuration,
    formatPace
  };
}