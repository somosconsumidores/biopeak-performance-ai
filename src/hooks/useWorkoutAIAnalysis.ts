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
      
      // Store in localStorage and state
      localStorage.setItem(`workout_analysis_${activityId}`, JSON.stringify(data.analysis));
      setAnalysis(data.analysis);
    } catch (err) {
      console.error('AI Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze workout');
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