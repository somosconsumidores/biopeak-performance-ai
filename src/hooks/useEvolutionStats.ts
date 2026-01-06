import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getCache, setCache, CACHE_KEYS, CACHE_DURATIONS } from '@/lib/cache';

const CACHE_DURATION = CACHE_DURATIONS.DAILY;

export interface WeeklyVO2 {
  week: string;
  vo2Max: number | null;
}

export interface WeeklyDistance {
  week: string;
  totalKm: number;
}

export interface WeeklyPace {
  week: string;
  avgPace: number | null;
}

export interface WeeklyHeartRate {
  week: string;
  avgHR: number | null;
  maxHR: number | null;
}

export interface WeeklyCalories {
  week: string;
  totalCalories: number;
}

export interface ActivityDistribution {
  type: string;
  count: number;
  percentage: number;
}

export interface EvolutionStats {
  calculatedAt: string;
  vo2Evolution: WeeklyVO2[];
  distanceEvolution: WeeklyDistance[];
  paceEvolution: Record<string, WeeklyPace[]>;
  heartRateEvolution: WeeklyHeartRate[];
  caloriesEvolution: WeeklyCalories[];
  activityDistribution: ActivityDistribution[];
}

export function useEvolutionStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<EvolutionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (forceRefresh = false) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getCache<EvolutionStats>(CACHE_KEYS.EVOLUTION_STATS, user.id, CACHE_DURATION);
      if (cached) {
        console.log('[useEvolutionStats] Using cached data');
        setStats(cached);
        setLoading(false);
        return;
      }
    }

    console.log('[useEvolutionStats] Fetching from database...');
    setLoading(true);

    try {
      const { data, error: fetchError } = await supabase
        .from('user_evolution_stats')
        .select('stats_data, calculated_at')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        // No data yet - trigger calculation
        if (fetchError.code === 'PGRST116') {
          console.log('[useEvolutionStats] No stats found, triggering calculation...');
          await triggerCalculation();
          return;
        }
        throw fetchError;
      }

      if (data?.stats_data) {
        const statsData = data.stats_data as unknown as EvolutionStats;
        setStats(statsData);
        setCache(CACHE_KEYS.EVOLUTION_STATS, statsData, user.id);
        console.log('[useEvolutionStats] Stats loaded and cached');
      }
    } catch (err: any) {
      console.error('[useEvolutionStats] Error:', err);
      setError(err.message || 'Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const triggerCalculation = async () => {
    if (!user?.id) return;

    try {
      console.log('[useEvolutionStats] Triggering stats calculation for user:', user.id);
      const { error: calcError } = await supabase.functions.invoke('calculate-evolution-stats', {
        body: { userId: user.id }
      });
      
      if (calcError) {
        console.error('[useEvolutionStats] Calculation error:', calcError);
        setError('Erro ao calcular estatísticas');
        setLoading(false);
        return;
      }

      // Fetch again after calculation
      setTimeout(() => fetchStats(true), 2000);
    } catch (err: any) {
      console.error('[useEvolutionStats] Error triggering calculation:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const refresh = useCallback(() => {
    return fetchStats(true);
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh,
    hasData: !!stats && (
      stats.vo2Evolution.length > 0 ||
      stats.distanceEvolution.length > 0 ||
      stats.activityDistribution.length > 0
    ),
  };
}
