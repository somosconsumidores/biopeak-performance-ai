import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePlatform } from '@/hooks/usePlatform';
import { revenueCat } from '@/lib/revenuecat';

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
  const { isIOS, isNative } = usePlatform();

  const checkSubscription = async () => {
    if (!user) {
      setSubscriptionData({ subscribed: false });
      setLoading(false);
      return;
    }

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('❌ Subscription check timed out after 30 seconds');
      setSubscriptionData({ subscribed: false });
      setLoading(false);
    }, 30000);

    try {
      setLoading(true);
      
      // For iOS native, check RevenueCat first, then fall back to Stripe/server
      if (isIOS && isNative) {
        try {
          await Promise.race([
            revenueCat.initialize(user.id),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('RevenueCat initialization timeout')), 10000)
            )
          ]);
          
          const customerInfo = await Promise.race([
            revenueCat.getCustomerInfo(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('RevenueCat getCustomerInfo timeout')), 10000)
            )
          ]) as any;
          
          if (customerInfo?.entitlements?.active) {
            const activeEntitlements = Object.keys(customerInfo.entitlements.active);
            if (activeEntitlements.length > 0) {
              const entitlement = customerInfo.entitlements.active[activeEntitlements[0]];
              clearTimeout(timeoutId);
              setSubscriptionData({
                subscribed: entitlement.isActive,
                subscription_tier: 'premium',
                subscription_end: entitlement.expirationDate || null,
              });
              setLoading(false);
              return;
            }
          }
        } catch (rcError) {
          console.log('RevenueCat check failed, falling back to server:', rcError);
        }
      }
      
      // Server-side check (Stripe or cached data)
      // Tenta obter um token válido (refresca se necessário)
      let token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        const { data: refreshed } = await Promise.race([
          supabase.auth.refreshSession(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Token refresh timeout')), 10000)
          )
        ]) as any;
        token = refreshed?.session?.access_token;
      }

      if (!token) {
        console.warn('No valid session token available after refresh');
        clearTimeout(timeoutId);
        setSubscriptionData({ subscribed: false });
        setLoading(false);
        return;
      }

      // Função para invocar a edge function com o token atual
      const invokeCheck = async (accessToken: string) =>
        Promise.race([
          supabase.functions.invoke('check-subscription', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Function invoke timeout')), 15000)
          )
        ]) as any;

      // 1ª tentativa
      let { data, error } = await invokeCheck(token);

      // Se falhar por problema de autenticação, tenta 1 refresh e re-tenta
      const authErrorMsg = error?.message || '';
      if (
        error && (
          authErrorMsg.includes('Authentication error') ||
          authErrorMsg.includes('session_id') ||
          authErrorMsg.toLowerCase().includes('jwt') ||
          authErrorMsg.toLowerCase().includes('bearer')
        )
      ) {
        const { data: refreshed } = await Promise.race([
          supabase.auth.refreshSession(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Retry token refresh timeout')), 10000)
          )
        ]) as any;
        const retryToken = refreshed?.session?.access_token;
        if (retryToken) {
          ({ data, error } = await invokeCheck(retryToken));
        }
      }

      if (error) {
        console.error('Erro ao verificar assinatura:', error);
        // Tenta buscar dados em cache no banco como fallback
        const { data: cachedData } = await Promise.race([
          supabase
            .from('subscribers')
            .select('*')
            .eq('user_id', user.id)
            .single(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Cache query timeout')), 5000)
          )
        ]) as any;
        
        if (cachedData) {
          clearTimeout(timeoutId);
          setSubscriptionData({
            subscribed: cachedData.subscribed,
            subscription_tier: cachedData.subscription_tier,
            subscription_end: cachedData.subscription_end
          });
        } else {
          clearTimeout(timeoutId);
          setSubscriptionData({ subscribed: false });
        }
      } else {
        clearTimeout(timeoutId);
        setSubscriptionData(data);
      }
    } catch (error) {
      console.error('Erro na verificação de assinatura:', error);
      clearTimeout(timeoutId);
      setSubscriptionData({ subscribed: false });
    } finally {
      clearTimeout(timeoutId);
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