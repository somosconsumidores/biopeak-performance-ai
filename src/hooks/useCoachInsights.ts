import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface InsightData {
  title: string;
  body: string;
  status: 'positive' | 'warning' | 'neutral';
  icon: string;
  kpi_value?: string;
  kpi_label?: string;
}

export interface CoachInsight {
  id: string;
  insight_type: string;
  insight_data: InsightData;
  created_at: string;
}

export const useCoachInsights = () => {
  const { user } = useAuth();
  const [insights, setInsights] = useState<CoachInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
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

        // Debug: log raw data from Supabase
        console.log('[useCoachInsights] Raw Data:', data);

        // Parse and validate insight_data JSON safely
        const parsedInsights: CoachInsight[] = (data || [])
          .map((row): CoachInsight | null => {
            try {
              // Defensive parsing: handle string or object
              let insightData: InsightData;
              if (typeof row.insight_data === 'string') {
                insightData = JSON.parse(row.insight_data) as InsightData;
              } else if (row.insight_data && typeof row.insight_data === 'object') {
                insightData = row.insight_data as InsightData;
              } else {
                console.warn('[useCoachInsights] Invalid insight_data format:', row.insight_data);
                return null;
              }
              
              // Flexible validation: check if object has required fields
              if (!insightData || typeof insightData !== 'object' || !insightData.title || !insightData.body) {
                console.warn('[useCoachInsights] Missing required fields:', insightData);
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
        // Since query is ordered by created_at DESC, first occurrence is most recent
        const seenTypes = new Map<string, CoachInsight>();
        for (const insight of parsedInsights) {
          if (!seenTypes.has(insight.insight_type)) {
            seenTypes.set(insight.insight_type, insight);
          }
        }
        const deduplicatedInsights = Array.from(seenTypes.values());

        setInsights(deduplicatedInsights);
      } catch (err) {
        console.error('[useCoachInsights] Unexpected error:', err);
        setError('Erro ao carregar insights');
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [user]);

  return { insights, loading, error };
};
