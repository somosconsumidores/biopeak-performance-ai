import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import type { UnifiedActivity } from '@/hooks/useUnifiedActivityHistory';

interface VariationAnalysisResult {
  heartRateCV: number | null;
  heartRateCVCategory: 'Baixo' | 'Alto' | null;
  paceCV: number | null;
  paceCVCategory: 'Baixo' | 'Alto' | null;
  diagnosis: string;
  dataPoints: number;
  hasValidData: boolean;
}

export const useOptimizedVariationAnalysis = (activity: UnifiedActivity | null) => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [analysis, setAnalysis] = useState<VariationAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  const calculateVariationCoefficients = async (activityData: UnifiedActivity) => {
    if (!user) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      console.log('Fetching optimized variation analysis for activity:', activityData.activity_id);

      const activitySource = activityData.source.toLowerCase();
      console.log('Activity source detected:', activitySource);

      // Determine owner and adjust query for admin route
      const activityOwnerId = isAdminRoute ? (
        await supabase
          .from('all_activities')  
          .select('user_id')
          .eq('activity_id', activityData.activity_id)
      ).data?.[0]?.user_id || user.id : user.id;

      // Buscar dados otimizados da tabela activity_variation_analysis
      const { data: variationData, error: variationError } = await supabase
        .from('activity_variation_analysis')
        .select('*')
        .eq('user_id', activityOwnerId)
        .eq('activity_id', activityData.activity_id)
        .eq('activity_source', activitySource)
        .maybeSingle();

      if (variationError) {
        console.error('Error fetching variation analysis:', variationError);
        setError('Erro ao buscar análise de variação');
        return;
      }

      if (!variationData) {
        console.log('No optimized variation analysis found, triggering ETL processing...');
        
        // Tentar processar via ETL
        try {
          const etlFunction = isAdminRoute && isAdmin ? 'admin-trigger-etl' : 'process-activity-data-etl';
          const etlBody = isAdminRoute && isAdmin 
            ? { activity_id: activityData.activity_id, activity_source: activitySource }
            : { user_id: activityOwnerId, activity_id: activityData.activity_id, activity_source: activitySource };
          
          const { error: etlError } = await supabase.functions.invoke(etlFunction, { body: etlBody });

          if (etlError) {
            console.error('ETL processing error:', etlError);
            setError('Erro ao processar dados da atividade');
            return;
          }

          // Tentar buscar novamente após ETL
          const { data: newVariationData } = await supabase
            .from('activity_variation_analysis')
            .select('*')
            .eq('user_id', activityOwnerId)
            .eq('activity_id', activityData.activity_id)
            .eq('activity_source', activitySource)
            .maybeSingle();

          if (!newVariationData) {
            setError('Dados insuficientes para análise de variação');
            return;
          }

          // Usar os novos dados
          buildAnalysis(newVariationData);
        } catch (etlError) {
          console.error('Error in ETL processing:', etlError);
          setError('Erro ao processar dados da atividade');
        }
      } else {
        // Usar dados existentes
        buildAnalysis(variationData);
      }

    } catch (error) {
      console.error('Error in variation analysis:', error);
      setError('Erro ao calcular análise de variação');
    } finally {
      setLoading(false);
    }
  };

  const buildAnalysis = (variationData: any) => {
    const result: VariationAnalysisResult = {
      heartRateCV: variationData.heart_rate_cv,
      heartRateCVCategory: variationData.heart_rate_cv_category,
      paceCV: variationData.pace_cv,
      paceCVCategory: variationData.pace_cv_category,
      diagnosis: variationData.diagnosis || 'Análise processada via dados otimizados',
      dataPoints: variationData.data_points || 0,
      hasValidData: variationData.has_valid_data || false
    };

    setAnalysis(result);
  };

  useEffect(() => {
    if (user && activity) {
      calculateVariationCoefficients(activity);
    }
  }, [user, activity]);

  const refetch = () => {
    if (activity) {
      calculateVariationCoefficients(activity);
    }
  };

  return { analysis, loading, error, refetch };
};