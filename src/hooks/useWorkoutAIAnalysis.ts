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
}

export const useWorkoutAIAnalysis = (): UseWorkoutAIAnalysisReturn => {
  const [analysis, setAnalysis] = useState<WorkoutAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeWorkout = async (activityId: string) => {
    if (!activityId) {
      setError('Activity ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🤖 AI Hook: Starting analysis for activity:', activityId);

      const { data, error: functionError } = await supabase.functions.invoke('analyze-workout', {
        body: { activityId }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        throw new Error(functionError.message || 'Failed to analyze workout');
      }

      if (!data || !data.analysis) {
        throw new Error('No analysis data received');
      }

      console.log('🤖 AI Hook: Analysis completed successfully');
      setAnalysis(data.analysis);
    } catch (err) {
      console.error('AI Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze workout');
    } finally {
      setLoading(false);
    }
  };

  return {
    analysis,
    loading,
    error,
    analyzeWorkout,
  };
};