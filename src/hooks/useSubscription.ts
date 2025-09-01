import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string;
}

export const useSubscription = () => {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const checkSubscription = async () => {
    if (!user) {
      setSubscriptionData({ subscribed: false });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Get fresh session token
      const session = await supabase.auth.getSession();
      if (!session.data.session?.access_token) {
        console.warn('No valid session token available');
        setSubscriptionData({ subscribed: false });
        setLoading(false);
        return;
      }
      
      // Chamar a função de verificação de assinatura
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.data.session.access_token}`,
        },
      });

      if (error) {
        console.error('Erro ao verificar assinatura:', error);
        // Try to get cached subscription data from database as fallback
        const { data: cachedData } = await supabase
          .from('subscribers')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (cachedData) {
          setSubscriptionData({
            subscribed: cachedData.subscribed,
            subscription_tier: cachedData.subscription_tier,
            subscription_end: cachedData.subscription_end
          });
        } else {
          setSubscriptionData({ subscribed: false });
        }
      } else {
        setSubscriptionData(data);
      }
    } catch (error) {
      console.error('Erro na verificação de assinatura:', error);
      setSubscriptionData({ subscribed: false });
    } finally {
      setLoading(false);
    }
  };

  const refreshSubscription = async () => {
    await checkSubscription();
  };

  useEffect(() => {
    if (user) {
      checkSubscription();
    } else {
      setSubscriptionData({ subscribed: false });
      setLoading(false);
    }
  }, [user]);

  return {
    isSubscribed: subscriptionData?.subscribed || false,
    subscriptionTier: subscriptionData?.subscription_tier,
    subscriptionEnd: subscriptionData?.subscription_end,
    loading,
    refreshSubscription,
  };
};