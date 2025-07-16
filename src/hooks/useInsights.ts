import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WeeklyInsight {
  title: string;
  description: string;
  change: string;
  isPositive: boolean;
}

interface PersonalizedMetric {
  label: string;
  value: number;
  unit: string;
  change: string;
  isPositive: boolean;
}

interface ZoneEffectiveness {
  zone: string;
  percentage: number;
  color: string;
}

interface WeeklyGoal {
  title: string;
  target: number;
  current: number;
  unit: string;
}

interface AIRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface PerformancePrediction {
  metric: string;
  currentValue: number;
  predictedValue: number;
  timeframe: string;
  confidence: number;
}

interface InsightsData {
  weeklyInsights: WeeklyInsight[];
  personalizedMetrics: PersonalizedMetric[];
  zoneEffectiveness: ZoneEffectiveness[];
  weeklyGoals: WeeklyGoal[];
  aiRecommendations: AIRecommendation[];
  performancePredictions: PerformancePrediction[];
}

export const useInsights = () => {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async (force = false) => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first (unless forced refresh)
      const cacheKey = 'insights_cache';
      const cacheTimeKey = 'insights_cache_time';
      const cached = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(cacheTimeKey);
      
      // Cache for 4 hours
      const CACHE_DURATION = 4 * 60 * 60 * 1000;
      const now = Date.now();
      
      if (!force && cached && cacheTime && (now - parseInt(cacheTime)) < CACHE_DURATION) {
        console.log('Using cached insights');
        setInsights(JSON.parse(cached));
        setLoading(false);
        return;
      }

      console.log('Fetching fresh insights from AI');
      const { data, error: functionError } = await supabase.functions.invoke('generate-insights');

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data) {
        throw new Error('No data received from insights function');
      }

      // Cache the results
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(cacheTimeKey, now.toString());

      setInsights(data);
    } catch (err) {
      console.error('Error fetching insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to load insights');
      
      // Try to use cached data on error
      const cached = localStorage.getItem('insights_cache');
      if (cached) {
        console.log('Using cached insights due to error');
        setInsights(JSON.parse(cached));
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshInsights = () => {
    fetchInsights(true);
  };

  const clearCache = () => {
    localStorage.removeItem('insights_cache');
    localStorage.removeItem('insights_cache_time');
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  return {
    insights,
    loading,
    error,
    refreshInsights,
    clearCache
  };
};