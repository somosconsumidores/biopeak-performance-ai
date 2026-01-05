import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getCache, setCache, CACHE_KEYS, CACHE_DURATIONS } from '@/lib/cache';

interface ProfileStats {
  totalActivities: number;
  totalDistance: number;
  avgDistance: number;
  totalDuration: number;
  avgHeartRate: number;
  maxHeartRate: number;
  avgPace: number;
  bestPace: number;
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

interface CachedStatsData {
  stats: ProfileStats;
  personalBests: PersonalBest[];
}

export function useProfileStats() {
  const { user } = useAuth();
  
  // Initialize with cache for instant loading
  const cached = getCache<CachedStatsData>(
    CACHE_KEYS.PROFILE_STATS,
    user?.id,
    CACHE_DURATIONS.LONG
  );
  
  const [stats, setStats] = useState<ProfileStats | null>(cached?.stats || null);
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>(cached?.personalBests || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setStats(null);
      setPersonalBests([]);
      setLoading(false);
      return;
    }

    // If we have cache, show it immediately and refresh in background
    if (cached) {
      setStats(cached.stats);
      setPersonalBests(cached.personalBests);
      setLoading(false);
      fetchStats(false); // Background refresh
    } else {
      fetchStats(true);
    }
  }, [user?.id]);

  const fetchStats = async (showLoading = true) => {
    if (!user) return;

    try {
      if (showLoading) setLoading(true);
      setError(null);

      // OPTIMIZATION: Select only needed fields and limit to 200 activities
      const { data: activities, error } = await supabase
        .from('all_activities')
        .select('id, activity_date, activity_type, total_distance_meters, total_time_minutes, average_heart_rate, max_heart_rate, pace_min_per_km, active_kilocalories')
        .eq('user_id', user.id)
        .order('activity_date', { ascending: false })
        .limit(200);

      if (error) throw error;

      if (!activities || activities.length === 0) {
        const emptyStats: ProfileStats = {
          totalActivities: 0,
          totalDistance: 0,
          avgDistance: 0,
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
        };
        setStats(emptyStats);
        setPersonalBests([]);
        setCache(CACHE_KEYS.PROFILE_STATS, { stats: emptyStats, personalBests: [] }, user.id);
        return;
      }

      const calculatedStats = calculateStats(activities);
      const bests = calculatePersonalBests(activities);

      setStats(calculatedStats);
      setPersonalBests(bests);
      
      // Update cache
      setCache(CACHE_KEYS.PROFILE_STATS, { stats: calculatedStats, personalBests: bests }, user.id);

    } catch (error) {
      console.error('Error fetching profile stats:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar estatísticas');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const calculateStats = (activities: any[]): ProfileStats => {
    const totalActivities = activities.length;
    const totalDistance = activities.reduce((sum, act) => sum + (act.total_distance_meters || 0), 0);
    
    const runningActivitiesForAvg = activities.filter(act => 
      (act.activity_type?.toLowerCase().includes('running') || 
       act.activity_type?.toLowerCase().includes('corrida')) &&
      act.total_distance_meters
    );
    const avgDistance = runningActivitiesForAvg.length > 0
      ? runningActivitiesForAvg.reduce((sum, act) => sum + (act.total_distance_meters || 0), 0) / runningActivitiesForAvg.length
      : 0;
    
    const totalDuration = activities.reduce((sum, act) => sum + ((act.total_time_minutes || 0) * 60), 0);
    const totalCalories = activities.reduce((sum, act) => sum + (act.active_kilocalories || 0), 0);

    const activitiesWithHR = activities.filter(act => act.average_heart_rate);
    const avgHeartRate = activitiesWithHR.length > 0 
      ? activitiesWithHR.reduce((sum, act) => sum + (act.average_heart_rate || 0), 0) / activitiesWithHR.length
      : 0;

    const maxHeartRate = Math.max(...activities.map(act => act.max_heart_rate || 0));

    const runningActivities = activities.filter(act => 
      act.activity_type?.toLowerCase().includes('running') || 
      act.activity_type?.toLowerCase().includes('corrida')
    );
    
    const runningActivitiesWithData = runningActivities.filter(act => 
      act.total_distance_meters && act.total_time_minutes && act.total_distance_meters > 0
    );
    const totalRunningDistance = runningActivitiesWithData.reduce((sum, act) => sum + (act.total_distance_meters || 0), 0);
    const totalRunningTime = runningActivitiesWithData.reduce((sum, act) => sum + (act.total_time_minutes || 0), 0);
    const avgPace = totalRunningDistance > 0 && totalRunningTime > 0
      ? totalRunningTime / (totalRunningDistance / 1000)
      : 0;
    
    const activitiesWithPace = runningActivities.filter(act => act.pace_min_per_km);
    const bestPace = activitiesWithPace.length > 0
      ? Math.min(...activitiesWithPace.map(act => act.pace_min_per_km || Infinity))
      : 0;

    const memberSince = activities[activities.length - 1]?.activity_date || null;
    const lastActivity = activities[0]?.activity_date || null;

    const firstActivityDate = new Date(memberSince || new Date());
    const now = new Date();
    const weeksDiff = Math.max(1, (now.getTime() - firstActivityDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const avgWeeklyActivities = totalActivities / weeksDiff;

    const currentStreak = calculateCurrentStreak(activities);

    return {
      totalActivities,
      totalDistance,
      avgDistance,
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
      vo2Max: null,
      restingHeartRate: null
    };
  };

  const calculateCurrentStreak = (activities: any[]) => {
    if (activities.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let streak = 0;
    let currentDate = new Date(today);

    const hasRecentActivity = activities.some(act => {
      const actDate = new Date(act.activity_date);
      actDate.setHours(0, 0, 0, 0);
      const diffDays = (today.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 1;
    });

    if (!hasRecentActivity) return 0;

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

  const calculatePersonalBests = (activities: any[]): PersonalBest[] => {
    const bests: PersonalBest[] = [];

    const longestActivity = activities.reduce((max, act) => 
      (act.total_distance_meters || 0) > (max.total_distance_meters || 0) ? act : max
    );
    if (longestActivity.total_distance_meters) {
      bests.push({
        metric: 'Maior Distância',
        value: `${(longestActivity.total_distance_meters / 1000).toFixed(1)} km`,
        date: new Date(longestActivity.activity_date + 'T00:00:00').toLocaleDateString('pt-BR'),
        activityType: longestActivity.activity_type || 'Atividade'
      });
    }

    const runningActivities = activities.filter(act => 
      (act.activity_type?.toLowerCase().includes('running') || 
       act.activity_type?.toLowerCase().includes('corrida')) &&
      act.pace_min_per_km
    );
    
    if (runningActivities.length > 0) {
      const bestPaceActivity = runningActivities.reduce((best, act) => 
        (act.pace_min_per_km || Infinity) < (best.pace_min_per_km || Infinity) ? act : best
      );
      
      bests.push({
        metric: 'Melhor Pace',
        value: `${Math.floor(bestPaceActivity.pace_min_per_km)}:${String(Math.round((bestPaceActivity.pace_min_per_km % 1) * 60)).padStart(2, '0')}/km`,
        date: new Date(bestPaceActivity.activity_date + 'T00:00:00').toLocaleDateString('pt-BR'),
        activityType: bestPaceActivity.activity_type || 'Corrida'
      });
    }

    const maxHRActivity = activities.reduce((max, act) => 
      (act.max_heart_rate || 0) > (max.max_heart_rate || 0) ? act : max
    );
    if (maxHRActivity.max_heart_rate) {
      bests.push({
        metric: 'FC Máxima',
        value: `${maxHRActivity.max_heart_rate} bpm`,
        date: new Date(maxHRActivity.activity_date + 'T00:00:00').toLocaleDateString('pt-BR'),
        activityType: maxHRActivity.activity_type || 'Atividade'
      });
    }

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

    return bests.slice(0, 4);
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
    refetch: () => fetchStats(true),
    formatDistance,
    formatDuration,
    formatPace
  };
}
