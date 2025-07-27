import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TrainingRecommendation {
  type: 'workout' | 'recovery' | 'plan' | 'goal';
  title: string;
  description: string;
  workoutDetails?: {
    type: string;
    duration: string;
    intensity: string;
    zones?: string[];
  };
  benefits: string[];
  priority: 'high' | 'medium' | 'low';
  category: string;
  reasoning: string;
}

export interface TrainingRecommendations {
  recommendations: TrainingRecommendation[];
  weeklyPlan: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
  focusAreas: string[];
  nextGoal: {
    suggestion: string;
    timeframe: string;
    steps: string[];
  };
}

interface UseTrainingRecommendationsReturn {
  recommendations: TrainingRecommendations | null;
  loading: boolean;
  error: string | null;
  refreshRecommendations: () => void;
  clearCache: () => void;
}

export const useTrainingRecommendations = (): UseTrainingRecommendationsReturn => {
  const [recommendations, setRecommendations] = useState<TrainingRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async (force = false) => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first (unless forced refresh)
      const cacheKey = 'training_recommendations_cache';
      const cacheTimeKey = 'training_recommendations_cache_time';
      const cached = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(cacheTimeKey);
      
      // Cache for 6 hours (training recommendations change less frequently)
      const CACHE_DURATION = 6 * 60 * 60 * 1000;
      const now = Date.now();
      
      if (!force && cached && cacheTime && (now - parseInt(cacheTime)) < CACHE_DURATION) {
        console.log('🏃‍♂️ Using cached training recommendations');
        setRecommendations(JSON.parse(cached));
        setLoading(false);
        return;
      }

      console.log('🏃‍♂️ Fetching fresh training recommendations from AI');
      const { data, error: functionError } = await supabase.functions.invoke('generate-training-recommendations');

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data) {
        throw new Error('No training recommendations data received');
      }

      // Cache the results
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(cacheTimeKey, now.toString());

      setRecommendations(data);
      console.log('✅ Training recommendations loaded successfully');
    } catch (err) {
      console.error('Error fetching training recommendations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load training recommendations');
      
      // Try to use cached data on error
      const cached = localStorage.getItem('training_recommendations_cache');
      if (cached) {
        console.log('🏃‍♂️ Using cached training recommendations due to error');
        setRecommendations(JSON.parse(cached));
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshRecommendations = () => {
    fetchRecommendations(true);
  };

  const clearCache = () => {
    localStorage.removeItem('training_recommendations_cache');
    localStorage.removeItem('training_recommendations_cache_time');
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return {
    recommendations,
    loading,
    error,
    refreshRecommendations,
    clearCache
  };
};