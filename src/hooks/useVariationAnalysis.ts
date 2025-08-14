import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { UnifiedActivity } from './useUnifiedActivityHistory';

interface VariationAnalysisResult {
  heartRateCV: number;
  heartRateCategory: 'Baixo' | 'Alto';
  paceCV: number | null;
  paceCategory: 'Baixo' | 'Alto' | null;
  diagnosis: string;
  hasHeartRateData: boolean;
  hasPaceData: boolean;
}

export const useVariationAnalysis = (user: any, activity: UnifiedActivity) => {
  const [analysis, setAnalysis] = useState<VariationAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !activity) {
      setAnalysis(null);
      setLoading(false);
      return;
    }

    const getOrCalculateVariationAnalysis = async () => {
      console.log(`🎯 ANÁLISE CV: Verificando cache para atividade ${activity.activity_id}`);
      
      setLoading(true);
      setError(null);
      setAnalysis(null);

      try {
        // Primeiro, verificar se já existe no cache
        const { data: cachedData, error: cacheError } = await supabase
          .from('variation_analysis_cache' as any)
          .select('*')
          .eq('activity_id', activity.activity_id)
          .eq('activity_source', activity.source)
          .eq('user_id', user.id)
          .single();

        if (!cacheError && cachedData) {
          console.log(`✅ Cache encontrado para ${activity.activity_id}`);
          const cache = cachedData as any;
          setAnalysis({
            heartRateCV: cache.heart_rate_cv,
            heartRateCategory: cache.heart_rate_category as 'Baixo' | 'Alto',
            paceCV: cache.pace_cv,
            paceCategory: cache.pace_category as 'Baixo' | 'Alto' | null,
            diagnosis: cache.diagnosis,
            hasHeartRateData: cache.has_heart_rate_data,
            hasPaceData: cache.has_pace_data
          });
          setLoading(false);
          return;
        }

        console.log(`📊 Cache não encontrado, calculando análise via Edge Function...`);
        
        // Se não existe cache, chamar Edge Function para calcular
        const { data: functionResult, error: functionError } = await supabase.functions.invoke(
          'calculate-variation-analysis',
          {
            body: {
              activityId: activity.activity_id,
              activitySource: activity.source,
              userId: user.id
            }
          }
        );

        if (functionError) {
          throw new Error(`Erro na Edge Function: ${functionError.message}`);
        }

        if (!functionResult?.success) {
          throw new Error(functionResult?.error || 'Erro desconhecido na análise');
        }

        const result = functionResult.data;
        setAnalysis({
          heartRateCV: result.heart_rate_cv,
          heartRateCategory: result.heart_rate_category as 'Baixo' | 'Alto',
          paceCV: result.pace_cv,
          paceCategory: result.pace_category as 'Baixo' | 'Alto' | null,
          diagnosis: result.diagnosis,
          hasHeartRateData: result.has_heart_rate_data,
          hasPaceData: result.has_pace_data
        });

        console.log(`✅ Análise calculada com sucesso para ${activity.activity_id}`);

      } catch (err: any) {
        console.error('❌ ERRO na análise de variação:', err);
        setError(`Erro na análise: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    getOrCalculateVariationAnalysis();
  }, [user, activity]);

  return {
    analysis,
    loading,
    error
  };
};