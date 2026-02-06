import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CACHE_KEYS, CACHE_DURATIONS, getCache, setCache } from '@/lib/cache';

export type SportCategory = 'RUNNING' | 'CYCLING' | 'SWIMMING';

export interface PersonalRecord {
  id: string;
  category: SportCategory;
  rank_position: number;
  activity_id: string;
  activity_date: string;
  best_pace_value: number;
  formatted_pace: string;
  activity_source: string;
  calculated_at: string;
}

export interface PersonalRecordsByCategory {
  RUNNING: PersonalRecord[];
  CYCLING: PersonalRecord[];
  SWIMMING: PersonalRecord[];
}

export function usePersonalRecords() {
  const { user } = useAuth();
  const [records, setRecords] = useState<PersonalRecordsByCategory>({
    RUNNING: [],
    CYCLING: [],
    SWIMMING: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async (showLoading = true) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('my_personal_records')
        .select('*')
        .eq('user_id', user.id)
        .order('category')
        .order('rank_position');

      if (queryError) throw queryError;

      const grouped: PersonalRecordsByCategory = {
        RUNNING: [],
        CYCLING: [],
        SWIMMING: [],
      };

      (data || []).forEach((record) => {
        const category = record.category as SportCategory;
        if (grouped[category]) {
          grouped[category].push(record as PersonalRecord);
        }
      });

      setRecords(grouped);
      setCache(CACHE_KEYS.PERSONAL_RECORDS, grouped, user.id);
    } catch (err) {
      console.error('[usePersonalRecords] Error:', err);
      setError('Erro ao carregar recordes pessoais');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    // Try cache first
    const cached = getCache<PersonalRecordsByCategory>(
      CACHE_KEYS.PERSONAL_RECORDS,
      user.id,
      CACHE_DURATIONS.DAILY
    );

    if (cached) {
      setRecords(cached);
      setLoading(false);
      // Background refresh
      fetchRecords(false);
    } else {
      fetchRecords(true);
    }
  }, [user?.id, fetchRecords]);

  const hasAnyRecords = 
    records.RUNNING.length > 0 || 
    records.CYCLING.length > 0 || 
    records.SWIMMING.length > 0;

  return {
    records,
    loading,
    error,
    refresh: fetchRecords,
    hasAnyRecords,
  };
}
