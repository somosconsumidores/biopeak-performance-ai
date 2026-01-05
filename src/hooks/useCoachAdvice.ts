import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getCache, setCache, CACHE_KEYS, CACHE_DURATIONS } from '@/lib/cache';

export interface CoachAdvice {
  id: string;
  advice: string;
  created_at: string;
}

const formatCoachText = (text: string): string => {
  if (!text) return '';
  
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .replace(/_/g, ' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-•]\s*/gm, '')
    .replace(/^\d+\.\s*/gm, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const useCoachAdvice = (isSubscribed: boolean | undefined) => {
  const { user } = useAuth();
  
  // Initialize with cache for instant loading
  const cached = getCache<CoachAdvice>(
    CACHE_KEYS.COACH_ADVICE,
    user?.id,
    CACHE_DURATIONS.COACH
  );
  
  const [advice, setAdvice] = useState<CoachAdvice | null>(cached);
  const [loading, setLoading] = useState(!cached && isSubscribed !== false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSubscribed === false) {
      setLoading(false);
      setAdvice(null);
      return;
    }

    if (!user || isSubscribed === undefined) {
      return;
    }

    // If we have cache, show it immediately and refresh in background
    if (cached) {
      setAdvice(cached);
      setLoading(false);
      fetchAdvice(false);
    } else {
      fetchAdvice(true);
    }
  }, [user?.id, isSubscribed]);

  const fetchAdvice = async (showLoading = true) => {
    if (!user) return;

    try {
      if (showLoading) setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('ai_coach_insights_history')
        .select('id, insight_data, created_at')
        .eq('user_id', user.id)
        .eq('insight_type', 'coach_advice')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('[useCoachAdvice] Fetch error:', fetchError);
        setError(fetchError.message);
        return;
      }

      if (!data) {
        setAdvice(null);
        return;
      }

      let rawText: string;
      if (typeof data.insight_data === 'string') {
        rawText = data.insight_data;
      } else if (data.insight_data && typeof data.insight_data === 'object') {
        const insightObj = data.insight_data as Record<string, unknown>;
        rawText = (insightObj.text as string) || (insightObj.body as string) || (insightObj.advice as string) || JSON.stringify(data.insight_data);
      } else {
        rawText = '';
      }

      const formattedAdvice = formatCoachText(rawText);
      const adviceData: CoachAdvice = {
        id: data.id,
        advice: formattedAdvice,
        created_at: data.created_at,
      };

      setAdvice(adviceData);
      setCache(CACHE_KEYS.COACH_ADVICE, adviceData, user.id);
    } catch (err) {
      console.error('[useCoachAdvice] Unexpected error:', err);
      setError('Erro ao carregar conselho do coach');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  return { advice, loading, error };
};
