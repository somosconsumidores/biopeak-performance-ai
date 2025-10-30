import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TrainingPlanAnalysisResult {
  analysis: string | null;
  completedWorkouts: number;
  totalWorkouts: number;
  message?: string;
}

interface UseTrainingPlanAnalysisReturn {
  result: TrainingPlanAnalysisResult | null;
  loading: boolean;
  error: string | null;
  analyzePlan: (planId: string) => Promise<void>;
  clearAnalysis: () => void;
}

export const useTrainingPlanAnalysis = (): UseTrainingPlanAnalysisReturn => {
  const [result, setResult] = useState<TrainingPlanAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzePlan = async (planId: string) => {
    if (!planId) {
      setError('ID do plano é obrigatório');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🎯 Starting training plan analysis for:', planId);

      const { data, error: functionError } = await supabase.functions.invoke('analyze-training-plan', {
        body: { planId }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        throw new Error(functionError.message || 'Falha ao analisar plano');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      console.log('✅ Analysis completed successfully');
      setResult(data);
    } catch (err) {
      console.error('Training plan analysis error:', err);
      setError(err instanceof Error ? err.message : 'Falha ao analisar plano');
    } finally {
      setLoading(false);
    }
  };

  const clearAnalysis = () => {
    setResult(null);
    setError(null);
  };

  return {
    result,
    loading,
    error,
    analyzePlan,
    clearAnalysis,
  };
};
