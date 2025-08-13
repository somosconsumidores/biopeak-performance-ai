import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WorkoutAnalysis {
  whatWorked: string[];
  toImprove: string[];
  recommendations: string[];
  performanceInsights: {
    efficiency: string;
    pacing: string;
    heartRateAnalysis: string;
    effortDistribution: string;
  };
  recoveryGuidance: {
    estimatedRecoveryTime: string;
    nextWorkoutSuggestions: string;
    nutritionTips: string;
  };
}

interface UseWorkoutAIAnalysisReturn {
  analysis: WorkoutAnalysis | null;
  loading: boolean;
  error: string | null;
  analyzeWorkout: (activityId: string) => Promise<void>;
  clearAnalysis: () => void;
}

export const useWorkoutAIAnalysis = (): UseWorkoutAIAnalysisReturn => {
  const [analysis, setAnalysis] = useState<WorkoutAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(null);

  // Load analysis from localStorage when activityId changes
  useEffect(() => {
    const loadStoredAnalysis = (activityId: string) => {
      try {
        const stored = localStorage.getItem(`workout_analysis_${activityId}`);
        if (stored) {
          const parsedAnalysis = JSON.parse(stored);
          setAnalysis(parsedAnalysis);
          console.log('🤖 AI Hook: Loaded stored analysis for activity:', activityId);
        } else {
          setAnalysis(null);
        }
      } catch (err) {
        console.error('Error loading stored analysis:', err);
        setAnalysis(null);
      }
    };

    if (currentActivityId) {
      loadStoredAnalysis(currentActivityId);
    }
  }, [currentActivityId]);

  const analyzeWorkout = async (activityId: string) => {
    if (!activityId) {
      setError('Activity ID is required');
      return;
    }

    setCurrentActivityId(activityId);
    setLoading(true);
    setError(null);

    try {
      console.log('🤖 AI Hook: Starting analysis for activity:', activityId);

      // Add timeout and retry logic for network issues
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const { data, error: functionError } = await supabase.functions.invoke('analyze-workout', {
        body: { activityId },
        headers: {
          'Content-Type': 'application/json',
        }
      });

      clearTimeout(timeoutId);

      if (functionError) {
        console.error('Function error:', functionError);
        
        // Check if it's a network error
        if (functionError.message?.includes('Failed to fetch') || 
            functionError.message?.includes('NetworkError') ||
            functionError.message?.includes('Failed to send a request')) {
          throw new Error('Erro de conectividade. Verifique sua conexão de internet e tente novamente em alguns instantes.');
        }
        
        throw new Error(functionError.message || 'Falha na análise do treino');
      }

      if (!data || !data.analysis) {
        throw new Error('Nenhum dado de análise foi recebido');
      }

      console.log('🤖 AI Hook: Analysis completed successfully');
      
      // Store in localStorage and state
      localStorage.setItem(`workout_analysis_${activityId}`, JSON.stringify(data.analysis));
      setAnalysis(data.analysis);
    } catch (err) {
      console.error('AI Analysis error:', err);
      
      // Provide more specific error messages
      let errorMessage = 'Falha na análise do treino';
      
      if (err instanceof Error) {
        if (err.message.includes('Activity not found')) {
          errorMessage = 'Atividade não encontrada. Verifique se a atividade existe e tente novamente.';
        } else if (err.message.includes('conectividade') || err.message.includes('Failed to fetch')) {
          errorMessage = 'Problema de conectividade. Verifique sua internet e tente novamente.';
        } else if (err.message.includes('Authorization')) {
          errorMessage = 'Sessão expirada. Faça login novamente.';
        } else if (err.message) {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const clearAnalysis = () => {
    if (currentActivityId) {
      localStorage.removeItem(`workout_analysis_${currentActivityId}`);
    }
    setAnalysis(null);
    setError(null);
  };

  return {
    analysis,
    loading,
    error,
    analyzeWorkout,
    clearAnalysis,
  };
};