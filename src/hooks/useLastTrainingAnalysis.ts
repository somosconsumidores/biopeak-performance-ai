import { useState, useEffect } from 'react';
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
  
  // Initialize with cache for instant loading
  const cached = getCache<LastTrainingAnalysis>(
    CACHE_KEYS.LAST_TRAINING_ANALYSIS,
    user?.id,
    CACHE_DURATIONS.LAST_TRAINING
  );
  
  const [analysis, setAnalysis] = useState<LastTrainingAnalysis | null>(cached);
  const [loading, setLoading] = useState(!cached && isSubscribed !== false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async (showLoading = true) => {
    if (!user?.id || !isSubscribed) {
      return;
    }

    try {
      if (showLoading) setLoading(true);
      
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
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (isSubscribed === false) {
      setLoading(false);
      setAnalysis(null);
      return;
    }

    if (!user || isSubscribed === undefined) {
      return;
    }

    // If we have cache, show it immediately and refresh in background
    if (cached) {
      setAnalysis(cached);
      setLoading(false);
      fetchAnalysis(false); // Background refresh
    } else {
      fetchAnalysis(true);
    }
  }, [user?.id, isSubscribed]);

  return { analysis, loading, error };
}
