import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getCache, setCache, CACHE_KEYS, CACHE_DURATIONS } from '@/lib/cache';

export interface InsightData {
  title: string;
  body: string;
  status: 'positive' | 'warning' | 'neutral';
  icon: string;
  kpi_value?: string | number;
  kpi_label?: string;
}

export interface CoachInsight {
  id: string;
  insight_type: string;
  insight_data: InsightData;
  created_at: string;
}

export const useCoachInsights = (isSubscribed: boolean | undefined) => {
  const { user } = useAuth();
  
  // Initialize with cache for instant loading
  const cached = getCache<CoachInsight[]>(
    CACHE_KEYS.COACH_INSIGHTS,
    user?.id,
    CACHE_DURATIONS.COACH
  );
  
  const [insights, setInsights] = useState<CoachInsight[]>(cached || []);
  const [loading, setLoading] = useState(!cached && isSubscribed !== false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSubscribed === false) {
      setLoading(false);
      setInsights([]);
      return;
    }

    if (!user || isSubscribed === undefined) {
      return;
    }

    // If we have cache, show it immediately and refresh in background
    if (cached && cached.length > 0) {
      setInsights(cached);
      setLoading(false);
      fetchInsights(false);
    } else {
      fetchInsights(true);
    }
  }, [user?.id, isSubscribed]);

  const fetchInsights = async (showLoading = true) => {
    if (!user) return;

    try {
      if (showLoading) setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('ai_coach_insights_history')
        .select('id, insight_type, insight_data, created_at')
        .eq('user_id', user.id)
        .in('insight_type', ['running_efficiency_trend', 'cycling_efficiency_trend', 'efficiency_trend', 'injury_risk_run'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (fetchError) {
        console.error('[useCoachInsights] Fetch error:', fetchError);
        setError(fetchError.message);
        return;
      }

      const parsedInsights: CoachInsight[] = (data || [])
        .map((row): CoachInsight | null => {
          try {
            let insightData: InsightData;
            if (typeof row.insight_data === 'string') {
              insightData = JSON.parse(row.insight_data) as InsightData;
            } else if (row.insight_data && typeof row.insight_data === 'object') {
              insightData = row.insight_data as InsightData;
            } else {
              return null;
            }
            
            if (!insightData || typeof insightData !== 'object' || !insightData.title || !insightData.body) {
              return null;
            }

            return {
              id: row.id,
              insight_type: row.insight_type,
              insight_data: {
                title: insightData.title,
                body: insightData.body,
                status: insightData.status || 'neutral',
                icon: insightData.icon || 'activity',
                kpi_value: insightData.kpi_value,
                kpi_label: insightData.kpi_label,
              },
              created_at: row.created_at,
            };
          } catch {
            return null;
          }
        })
        .filter((item): item is CoachInsight => item !== null);

      // Deduplicate: keep only the most recent insight of each type
      const seenTypes = new Map<string, CoachInsight>();
      for (const insight of parsedInsights) {
        if (!seenTypes.has(insight.insight_type)) {
          seenTypes.set(insight.insight_type, insight);
        }
      }
      const deduplicatedInsights = Array.from(seenTypes.values());

      setInsights(deduplicatedInsights);
      setCache(CACHE_KEYS.COACH_INSIGHTS, deduplicatedInsights, user.id);
    } catch (err) {
      console.error('[useCoachInsights] Unexpected error:', err);
      setError('Erro ao carregar insights');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  return { insights, loading, error };
};
