import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EfficiencySegment {
  segment_number: number;
  start_distance_m: number;
  end_distance_m: number;
  avg_pace_min_km: number;
  avg_hr: number;
  avg_power: number | null;
  avg_speed_ms: number;
  efficiency_score: number;
  hr_efficiency_delta: number | null;
  label: 'green' | 'yellow' | 'red';
  point_count: number;
}

export interface EfficiencyAlert {
  distance_km: string;
  description: string;
  severity: 'warning' | 'danger';
}

export interface EfficiencyRecommendation {
  icon: string;
  title: string;
  description: string;
}

export interface EfficiencyFingerprint {
  segments: EfficiencySegment[];
  alerts: EfficiencyAlert[];
  recommendations: EfficiencyRecommendation[];
  overall_score: number;
}

export function useEfficiencyFingerprint(activityId: string | null) {
  const [data, setData] = useState<EfficiencyFingerprint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activityId) return;

    let cancelled = false;

    async function fetchFingerprint() {
      setLoading(true);
      setError(null);

      try {
        // Check cache first
        const { data: cached } = await supabase
          .from('efficiency_fingerprint' as any)
          .select('segments, alerts, recommendations, overall_score')
          .eq('activity_id', activityId)
          .maybeSingle();

        if (cached && !cancelled) {
          setData({
            segments: (cached as any).segments || [],
            alerts: (cached as any).alerts || [],
            recommendations: (cached as any).recommendations || [],
            overall_score: (cached as any).overall_score || 0,
          });
          setLoading(false);
          return;
        }

        // Call edge function to compute
        let result: any = null;
        let fnError: any = null;
        
        try {
          const response = await supabase.functions.invoke(
            'analyze-efficiency-fingerprint',
            { body: { activity_id: activityId } }
          );
          result = response.data;
          fnError = response.error;
        } catch (invokeErr: any) {
          // Catch network/parsing errors from invoke itself
          console.warn('Efficiency fingerprint invoke error (caught):', invokeErr?.message);
          if (!cancelled) {
            setData(null);
            setLoading(false);
          }
          return;
        }

        // Handle edge function errors gracefully
        if (fnError) {
          const msg = fnError?.message || String(fnError);
          // "Not enough data" is expected for some activities — treat as empty
          if (msg.includes('non-2xx') || msg.includes('Not enough')) {
            console.log('Efficiency fingerprint: not enough data, skipping');
            if (!cancelled) setData(null);
            if (!cancelled) setLoading(false);
            return;
          }
          throw new Error(msg);
        }

        // Check for error in the response body
        if (result?.error) {
          const bodyMsg = String(result.error);
          if (bodyMsg.includes('Not enough')) {
            console.log('Efficiency fingerprint: not enough data (body), skipping');
            if (!cancelled) setData(null);
            if (!cancelled) setLoading(false);
            return;
          }
          throw new Error(bodyMsg);
        }

        if (!cancelled && result) {
          setData({
            segments: result.segments || [],
            alerts: result.alerts || [],
            recommendations: result.recommendations || [],
            overall_score: result.overall_score || 0,
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Efficiency fingerprint error:', err);
          setError(err.message || 'Erro ao calcular fingerprint');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFingerprint();
    return () => { cancelled = true; };
  }, [activityId]);

  return { data, loading, error };
}
