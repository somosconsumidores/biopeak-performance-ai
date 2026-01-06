import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AnalysisCache {
  analysis: string;
  generatedAt: string;
  userId: string;
}

const CACHE_KEY = 'biopeak_evolution_analysis_cache_v1';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function useEvolutionAnalysis() {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCachedAnalysis = useCallback((): AnalysisCache | null => {
    if (!user?.id) return null;
    
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      
      const cached: AnalysisCache = JSON.parse(raw);
      
      // Validate user match
      if (cached.userId !== user.id) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      
      // Validate expiration
      const cacheTime = new Date(cached.generatedAt).getTime();
      if (Date.now() - cacheTime > CACHE_DURATION) {
        return null;
      }
      
      return cached;
    } catch {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  }, [user?.id]);

  const setCachedAnalysis = useCallback((analysisText: string, timestamp: string) => {
    if (!user?.id) return;
    
    const cache: AnalysisCache = {
      analysis: analysisText,
      generatedAt: timestamp,
      userId: user.id,
    };
    
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn('[useEvolutionAnalysis] Failed to cache analysis:', e);
    }
  }, [user?.id]);

  const loadCachedAnalysis = useCallback(() => {
    const cached = getCachedAnalysis();
    if (cached) {
      setAnalysis(cached.analysis);
      setGeneratedAt(cached.generatedAt);
      return true;
    }
    return false;
  }, [getCachedAnalysis]);

  const generateAnalysis = useCallback(async (forceRegenerate = false) => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return;
    }

    // Check cache first (unless forcing regeneration)
    if (!forceRegenerate) {
      const cached = getCachedAnalysis();
      if (cached) {
        setAnalysis(cached.analysis);
        setGeneratedAt(cached.generatedAt);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-evolution-stats', {});

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.analysis) {
        setAnalysis(data.analysis);
        setGeneratedAt(data.generatedAt);
        setCachedAnalysis(data.analysis, data.generatedAt);
      }
    } catch (e) {
      console.error('[useEvolutionAnalysis] Error:', e);
      setError(e instanceof Error ? e.message : 'Erro ao gerar análise');
    } finally {
      setLoading(false);
    }
  }, [user?.id, getCachedAnalysis, setCachedAnalysis]);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setGeneratedAt(null);
    localStorage.removeItem(CACHE_KEY);
  }, []);

  return {
    analysis,
    generatedAt,
    loading,
    error,
    generateAnalysis,
    clearAnalysis,
    loadCachedAnalysis,
    hasCachedAnalysis: getCachedAnalysis() !== null,
  };
}
