import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AnalysisPurchase {
  id: string;
  activity_id: string;
  status: 'pending' | 'completed' | 'failed';
  purchased_at: string | null;
}

export const useAnalysisPurchases = (activityId: string | null) => {
  const { user } = useAuth();

  const { data: purchase, isLoading } = useQuery({
    queryKey: ['analysis-purchase', activityId, user?.id],
    queryFn: async () => {
      if (!activityId || !user?.id) return null;

      const { data, error } = await supabase
        .from('ai_analysis_purchases')
        .select('*')
        .eq('user_id', user.id)
        .eq('activity_id', activityId)
        .eq('status', 'completed')
        .maybeSingle();

      if (error) {
        console.error('Error fetching analysis purchase:', error);
        return null;
      }

      return data as AnalysisPurchase | null;
    },
    enabled: !!activityId && !!user?.id,
  });

  return {
    hasPurchased: !!purchase,
    purchase,
    loading: isLoading,
  };
};