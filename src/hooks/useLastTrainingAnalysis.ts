import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CACHE_KEYS, CACHE_DURATIONS, getCache, setCache } from '@/lib/cache';

interface LastTrainingAnalysis {
  id: string;
  analysis: string;
  createdAt: string;
}

interface UseLastTrainingAnalysisReturn {
  analysis: LastTrainingAnalysis | null;
  loading: boolean;
  error: string | null;
}

export function useLastTrainingAnalysis(isSubscribed: boolean): UseLastTrainingAnalysisReturn {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<LastTrainingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    if (!user?.id || !isSubscribed) {
      setLoading(false);
      return;
    }

    // Check cache first
    const cached = getCache<LastTrainingAnalysis>(
      CACHE_KEYS.LAST_TRAINING_ANALYSIS,
      user.id,
      CACHE_DURATIONS.LAST_TRAINING
    );

    if (cached) {
      setAnalysis(cached);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data, error: queryError } = await supabase
        .from('ai_coach_insights_history')
        .select('id, insight_data, created_at')
        .eq('user_id', user.id)
        .eq('insight_type', 'ia_analysis_training')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (queryError) {
        throw queryError;
      }

      if (data && data.insight_data) {
        // insight_data can be string or object with analysis field
        const analysisText = typeof data.insight_data === 'string' 
          ? data.insight_data 
          : (data.insight_data as { analysis?: string }).analysis || JSON.stringify(data.insight_data);

        const result: LastTrainingAnalysis = {
          id: data.id,
          analysis: analysisText,
          createdAt: data.created_at,
        };

        setAnalysis(result);
        setCache(CACHE_KEYS.LAST_TRAINING_ANALYSIS, result, user.id);
      } else {
        setAnalysis(null);
      }
    } catch (err) {
      console.error('[useLastTrainingAnalysis] Error:', err);
      setError('Erro ao carregar análise do treino');
    } finally {
      setLoading(false);
    }
  }, [user?.id, isSubscribed]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  return { analysis, loading, error };
}
