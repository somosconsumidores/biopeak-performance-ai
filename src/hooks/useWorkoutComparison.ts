import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityComparison {
  currentActivity: {
    id: string;
    type: string;
    classifiedType: string;
    duration: number | null;
    distance: number | null;
    pace: number | null;
    avgHeartRate: number | null;
    calories: number | null;
    elevation: number | null;
    date: string;
  };
  historicalStats: {
    totalActivities: number;
    avgDuration: number | null;
    avgDistance: number | null;
    avgPace: number | null;
    avgHeartRate: number | null;
    dateRange: string;
  };
  comparisons: {
    duration: {
      current: number | null;
      historical: number | null;
      difference: number | null;
      percentChange: number | null;
      isImprovement: boolean | null;
    };
    distance: {
      current: number | null;
      historical: number | null;
      difference: number | null;
      percentChange: number | null;
      isImprovement: boolean | null;
    };
    pace: {
      current: number | null;
      historical: number | null;
      difference: number | null;
      percentChange: number | null;
      isImprovement: boolean | null;
    };
    heartRate: {
      current: number | null;
      historical: number | null;
      difference: number | null;
      percentChange: number | null;
      isImprovement: boolean | null;
    };
  };
  aiRecommendations: {
    performanceAnalysis: string[];
    strengths: string[];
    areasToImprove: string[];
    recommendations: string[];
    recoveryGuidance: string;
    nextWorkoutSuggestions: string;
  };
}

interface UseWorkoutComparisonReturn {
  comparison: ActivityComparison | null;
  loading: boolean;
  error: string | null;
  analyzeWorkout: (activityId: string) => Promise<void>;
  clearComparison: () => void;
}

export const useWorkoutComparison = (): UseWorkoutComparisonReturn => {
  const [comparison, setComparison] = useState<ActivityComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(null);

  // Load comparison from localStorage when activityId changes
  useEffect(() => {
    const loadStoredComparison = (activityId: string) => {
      try {
        const stored = localStorage.getItem(`workout_comparison_${activityId}`);
        if (stored) {
          const parsedComparison = JSON.parse(stored);
          setComparison(parsedComparison);
          console.log('🔄 Loaded stored comparison for activity:', activityId);
        } else {
          setComparison(null);
        }
      } catch (err) {
        console.error('Error loading stored comparison:', err);
        setComparison(null);
      }
    };

    if (currentActivityId) {
      loadStoredComparison(currentActivityId);
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
      console.log('🚀 Starting workout comparison analysis for activity:', activityId);

      const { data, error: functionError } = await supabase.functions.invoke('analyze-workout-comparison', {
        body: { activityId }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        throw new Error(functionError.message || 'Failed to analyze workout comparison');
      }

      if (!data || !data.comparison) {
        throw new Error('No comparison data received');
      }

      console.log('✅ Workout comparison analysis completed successfully');
      
      // Store in localStorage and state
      localStorage.setItem(`workout_comparison_${activityId}`, JSON.stringify(data.comparison));
      setComparison(data.comparison);
    } catch (err) {
      console.error('❌ Workout comparison error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze workout comparison');
    } finally {
      setLoading(false);
    }
  };

  const clearComparison = () => {
    if (currentActivityId) {
      localStorage.removeItem(`workout_comparison_${currentActivityId}`);
    }
    setComparison(null);
    setError(null);
  };

  return {
    comparison,
    loading,
    error,
    analyzeWorkout,
    clearComparison,
  };
};