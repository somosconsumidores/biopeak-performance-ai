import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SleepAnalysisData {
  sleepScore: number;
  totalSleep: number;
  lightSleep: number;
  deepSleep: number;
  remSleep: number;
}

export interface OvertrainingAnalysisData {
  score: number;
  level: string;
  factors: string[];
}

export interface SleepAIAnalysis {
  analysis: string;
  analyzedAt: string;
}

interface UseSleepAIAnalysisReturn {
  analysis: SleepAIAnalysis | null;
  loading: boolean;
  error: string | null;
  analyzeSleep: (sleepData: SleepAnalysisData, overtrainingData: OvertrainingAnalysisData) => Promise<void>;
  clearAnalysis: () => void;
}

export const useSleepAIAnalysis = (): UseSleepAIAnalysisReturn => {
  const [analysis, setAnalysis] = useState<SleepAIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeSleep = async (sleepData: SleepAnalysisData, overtrainingData: OvertrainingAnalysisData) => {
    if (!sleepData) {
      setError('Dados de sono são obrigatórios');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🧠 Sleep AI Hook: Starting analysis');

      const { data, error: functionError } = await supabase.functions.invoke('analyze-sleep', {
        body: { 
          sleepData,
          overtrainingData
        }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        throw new Error(functionError.message || 'Falha ao analisar dados de sono');
      }

      if (!data || !data.analysis) {
        throw new Error('Nenhum dado de análise recebido');
      }

      console.log('🧠 Sleep AI Hook: Analysis completed successfully');
      setAnalysis(data);
    } catch (err) {
      console.error('Sleep AI Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Falha ao analisar dados de sono');
    } finally {
      setLoading(false);
    }
  };

  const clearAnalysis = () => {
    setAnalysis(null);
    setError(null);
  };

  return {
    analysis,
    loading,
    error,
    analyzeSleep,
    clearAnalysis,
  };
};