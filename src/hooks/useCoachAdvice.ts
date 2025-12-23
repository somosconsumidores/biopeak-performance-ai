import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CoachAdvice {
  id: string;
  advice: string;
  created_at: string;
}

/**
 * Formats raw coach advice text by removing markdown artifacts
 * and cleaning up special characters for professional display
 */
const formatCoachText = (text: string): string => {
  if (!text) return '';
  
  return text
    // Remove markdown bold/italic
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .replace(/_/g, ' ')
    // Remove markdown headers
    .replace(/^#{1,6}\s*/gm, '')
    // Remove bullet points and dashes at line start
    .replace(/^[-•]\s*/gm, '')
    // Remove numbered lists
    .replace(/^\d+\.\s*/gm, '')
    // Clean up multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Clean up multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace
    .trim();
};

export const useCoachAdvice = () => {
  const { user } = useAuth();
  const [advice, setAdvice] = useState<CoachAdvice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdvice = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('ai_coach_insights_history')
          .select('id, insight_data, created_at')
          .eq('user_id', user.id)
          .eq('insight_type', 'coach_advice')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          console.error('[useCoachAdvice] Fetch error:', fetchError);
          setError(fetchError.message);
          return;
        }

        if (!data) {
          setAdvice(null);
          return;
        }

        // insight_data can be a string or an object with text property
        let rawText: string;
        if (typeof data.insight_data === 'string') {
          rawText = data.insight_data;
        } else if (data.insight_data && typeof data.insight_data === 'object') {
          const insightObj = data.insight_data as Record<string, unknown>;
          rawText = (insightObj.text as string) || (insightObj.body as string) || (insightObj.advice as string) || JSON.stringify(data.insight_data);
        } else {
          rawText = '';
        }

        const formattedAdvice = formatCoachText(rawText);

        setAdvice({
          id: data.id,
          advice: formattedAdvice,
          created_at: data.created_at,
        });
      } catch (err) {
        console.error('[useCoachAdvice] Unexpected error:', err);
        setError('Erro ao carregar conselho do coach');
      } finally {
        setLoading(false);
      }
    };

    fetchAdvice();
  }, [user]);

  return { advice, loading, error };
};
