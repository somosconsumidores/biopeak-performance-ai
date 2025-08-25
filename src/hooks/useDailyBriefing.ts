import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WorkoutGuidance {
  primary?: 'pace' | 'hr';
  pace_min_per_km?: { min: string; max: string } | null;
  hr_bpm?: { min: number; max: number } | null;
  hr_zone?: string | null;
}

export interface DailyWorkout {
  sport: string;
  duration_min: number;
  intensity: 'easy' | 'moderate' | 'hard' | string;
  guidance?: WorkoutGuidance;
  structure?: Array<{ name: string; minutes: number; intensity?: string }>;
}

export interface DailyBriefingResponse {
  date: string;
  briefing: string;
  suggested_workout?: string;
  rationale?: string;
  workout?: DailyWorkout | null;
  keyMetrics?: any;
}

interface UseDailyBriefingReturn {
  briefing: DailyBriefingResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDailyBriefing(): UseDailyBriefingReturn {
  const [briefing, setBriefing] = useState<DailyBriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(async (force = false) => {
    try {
      setLoading(true);
      setError(null);

      const todayKey = new Date().toISOString().slice(0,10);
      const cacheKey = `daily_briefing_${todayKey}`;

      if (!force) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setBriefing(JSON.parse(cached));
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('generate-daily-briefing');
      if (error) throw new Error(error.message);
      if (!data) throw new Error('No briefing data');

      localStorage.setItem(cacheKey, JSON.stringify(data));
      setBriefing(data as DailyBriefingResponse);
    } catch (e: any) {
      setError(e.message || 'Falha ao gerar briefing do dia');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefing(false);
  }, [fetchBriefing]);

  const refresh = () => fetchBriefing(true);

  return { briefing, loading, error, refresh };
}
