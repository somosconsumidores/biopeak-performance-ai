import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePlatform } from '@/hooks/usePlatform';
import { revenueCat } from '@/lib/revenuecat';
import { debugLog, debugError, debugWarn } from '@/lib/debug';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string;
}

const CACHE_KEY = 'subscription_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useSubscription = () => {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isIOS, isNative } = usePlatform();

  // Load from cache on mount
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setSubscriptionData(data);
          setLoading(false);
          // Verify in background
          if (user) checkSubscription(true);
          return;
        }
      } catch (e) {
        localStorage.removeItem(CACHE_KEY);
      }
    }
  }, []);

  const checkSubscription = async (background = false) => {
    if (!user) {
      setSubscriptionData({ subscribed: false });
      setLoading(false);
      return;
    }

    // Reduced timeout from 30s to 10s
    const timeoutId = setTimeout(() => {
      debugError('❌ Subscription check timed out after 10 seconds');
      setSubscriptionData({ subscribed: false });
      setLoading(false);
    }, 10000);

    try {
      if (!background) setLoading(true);
      
      // For iOS native, check RevenueCat first, then fall back to Stripe/server
      if (isIOS && isNative) {
        try {
          await Promise.race([
            revenueCat.initialize(user.id),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('RevenueCat initialization timeout')), 5000)
            )
          ]);
          
          const customerInfo = await Promise.race([
            revenueCat.getCustomerInfo(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('RevenueCat getCustomerInfo timeout')), 5000)
            )
          ]) as any;
          
          if (customerInfo?.entitlements?.active) {
            const activeEntitlements = Object.keys(customerInfo.entitlements.active);
            if (activeEntitlements.length > 0) {
              const entitlement = customerInfo.entitlements.active[activeEntitlements[0]];
              clearTimeout(timeoutId);
              const data = {
                subscribed: entitlement.isActive,
                subscription_tier: 'premium',
                subscription_end: entitlement.expirationDate || null,
              };
              setSubscriptionData(data);
              // Cache result
              localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
              setLoading(false);
              return;
            }
          }
        } catch (rcError) {
          debugLog('RevenueCat check failed, falling back to server:', rcError);
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
        debugWarn('No valid session token available after refresh');
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
            setTimeout(() => reject(new Error('Function invoke timeout')), 8000)
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
        debugError('Erro ao verificar assinatura:', error);
        // Tenta buscar dados em cache no banco como fallback
        const { data: cachedData } = await Promise.race([
          supabase
            .from('subscribers')
            .select('*')
            .eq('user_id', user.id)
            .single(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Cache query timeout')), 3000)
          )
        ]) as any;
        
        if (cachedData) {
          clearTimeout(timeoutId);
          const data = {
            subscribed: cachedData.subscribed,
            subscription_tier: cachedData.subscription_tier,
            subscription_end: cachedData.subscription_end
          };
          setSubscriptionData(data);
          // Cache result
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        } else {
          clearTimeout(timeoutId);
          setSubscriptionData({ subscribed: false });
        }
      } else {
        clearTimeout(timeoutId);
        setSubscriptionData(data);
        // Cache result
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
      }
    } catch (error) {
      debugError('Erro na verificação de assinatura:', error);
      clearTimeout(timeoutId);
      setSubscriptionData({ subscribed: false });
    } finally {
      clearTimeout(timeoutId);
      if (!background) setLoading(false);
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