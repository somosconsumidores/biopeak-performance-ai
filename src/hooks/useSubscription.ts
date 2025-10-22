import { useState, useEffect, useCallback, useRef } from 'react';
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

const CACHE_VERSION = 'v2'; // Incrementar quando houver mudanças críticas
const CACHE_KEY = `subscription_cache_${CACHE_VERSION}`;
const SESSION_SUBSCRIPTION_KEY = `session_subscription_verified_${CACHE_VERSION}`;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export const useSubscription = () => {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isIOS, isNative } = usePlatform();
  const initializingRef = useRef(false);

  // Memoize checkSubscription with useCallback to prevent re-renders
  const checkSubscription = useCallback(async (background = false) => {
    if (!user) {
      setSubscriptionData({ subscribed: false });
      setLoading(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      debugError('❌ Subscription check timed out after 10 seconds');
      if (!background) {
        setSubscriptionData({ subscribed: false });
        setLoading(false);
      }
    }, 10000);

    try {
      if (!background) setLoading(true);
      
      // For iOS native, check RevenueCat first
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
              localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
              if (data.subscribed) {
                sessionStorage.setItem(SESSION_SUBSCRIPTION_KEY, JSON.stringify(data));
              }
              setLoading(false);
              return;
            }
          }
        } catch (rcError) {
          debugLog('RevenueCat check failed, falling back to server:', rcError);
        }
      }
      
      // Get token for server-side checks
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
        if (!background) {
          setSubscriptionData({ subscribed: false });
          setLoading(false);
        }
        return;
      }

      // PRIORITY 1: Try quick database check first (< 200ms)
      try {
        const { data: quickData, error: quickError } = await Promise.race([
          supabase.functions.invoke('quick-check-subscription', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Quick check timeout')), 3000)
          )
        ]) as any;

        if (!quickError && quickData?.subscribed) {
          debugLog('Quick check: Active subscription found', quickData);
          clearTimeout(timeoutId);
          setSubscriptionData(quickData);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: quickData, timestamp: Date.now() }));
          sessionStorage.setItem(SESSION_SUBSCRIPTION_KEY, JSON.stringify(quickData));
          if (!background) setLoading(false);
          return;
        }
        
        debugLog('Quick check: No active subscription, proceeding to full check');
      } catch (quickCheckError) {
        debugLog('Quick check failed, proceeding to full check', quickCheckError);
      }

      // PRIORITY 2: Full Stripe verification (only if quick check failed)
      const invokeCheck = async (accessToken: string) =>
        Promise.race([
          supabase.functions.invoke('check-subscription', {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Function invoke timeout')), 8000)
          )
        ]) as any;

      let { data, error } = await invokeCheck(token);

      // Retry on auth error
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
        
        // CRITICAL: In background mode, don't reset to false
        if (background) {
          debugWarn('Background check failed, keeping current subscription status');
          clearTimeout(timeoutId);
          return;
        }
        
        // Fallback to database cache
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
          const fallbackData = {
            subscribed: cachedData.subscribed,
            subscription_tier: cachedData.subscription_tier,
            subscription_end: cachedData.subscription_end
          };
          setSubscriptionData(fallbackData);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: fallbackData, timestamp: Date.now() }));
          
          if (fallbackData.subscribed) {
            sessionStorage.setItem(SESSION_SUBSCRIPTION_KEY, JSON.stringify(fallbackData));
          }
        } else {
          clearTimeout(timeoutId);
          setSubscriptionData({ subscribed: false });
        }
      } else {
        clearTimeout(timeoutId);
        setSubscriptionData(data);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        
        if (data.subscribed) {
          sessionStorage.setItem(SESSION_SUBSCRIPTION_KEY, JSON.stringify(data));
        }
      }
    } catch (error) {
      debugError('Erro na verificação de assinatura:', error);
      clearTimeout(timeoutId);
      
      if (!background) {
        setSubscriptionData({ subscribed: false });
      }
    } finally {
      clearTimeout(timeoutId);
      if (!background) setLoading(false);
    }
  }, [user, isIOS, isNative]); // Stable dependencies

  // Initialize subscription on mount and user change
  useEffect(() => {
    // Prevent double initialization
    if (initializingRef.current) return;
    
    const initializeSubscription = async () => {
      initializingRef.current = true;
      
      if (!user) {
        setSubscriptionData({ subscribed: false });
        setLoading(false);
        initializingRef.current = false;
        return;
      }

      // Check session lock first
      const sessionVerified = sessionStorage.getItem(SESSION_SUBSCRIPTION_KEY);
      if (sessionVerified) {
        try {
          const sessionData = JSON.parse(sessionVerified);
          
          // VALIDATION: Check if subscription has expired
          if (sessionData.subscription_end && new Date(sessionData.subscription_end) < new Date()) {
            debugWarn('Session subscription expired, forcing full check', { 
              subscription_end: sessionData.subscription_end 
            });
            sessionStorage.removeItem(SESSION_SUBSCRIPTION_KEY);
            // Continue to full check below
          } else {
            debugLog('Using session-verified subscription data', sessionData);
            setSubscriptionData(sessionData);
            setLoading(false);
            
            // Verify in background to ensure accuracy
            setTimeout(() => {
              checkSubscription(true);
            }, 1000);
            
            initializingRef.current = false;
            return;
          }
        } catch (e) {
          debugError('Session data parse error:', e);
          sessionStorage.removeItem(SESSION_SUBSCRIPTION_KEY);
        }
      }

      // Try fast DB check first before edge function
      try {
        const { data: dbSub } = await Promise.race([
          supabase
            .from('subscribers')
            .select('*')
            .eq('user_id', user.id)
            .single(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('DB query timeout')), 2000)
          )
        ]) as any;
        
        if (dbSub && dbSub.subscription_end && new Date(dbSub.subscription_end) > new Date()) {
          debugLog('Fast DB check: Active subscription found', dbSub);
          const fastData = {
            subscribed: dbSub.subscribed,
            subscription_tier: dbSub.subscription_tier,
            subscription_end: dbSub.subscription_end
          };
          setSubscriptionData(fastData);
          setLoading(false);
          
          // Verify with Stripe in background
          setTimeout(() => {
            checkSubscription(true);
          }, 2000);
          
          initializingRef.current = false;
          return;
        }
      } catch (e) {
        debugLog('Fast DB check failed, proceeding to full check', e);
      }

      // Try cache
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          
          // VALIDATION: Check if subscription has expired
          if (data.subscription_end && new Date(data.subscription_end) < new Date()) {
            debugWarn('Cached subscription expired, forcing full check', { 
              subscription_end: data.subscription_end 
            });
            localStorage.removeItem(CACHE_KEY);
            // Continue to full check below
          } else if (Date.now() - timestamp < CACHE_DURATION) {
            debugLog('Using cached subscription data', data);
            setSubscriptionData(data);
            setLoading(false);
            initializingRef.current = false;
            return;
          }
        } catch (e) {
          debugError('Cache parse error:', e);
          localStorage.removeItem(CACHE_KEY);
        }
      }

      // Full check
      await checkSubscription(false);
      initializingRef.current = false;
    };

    initializeSubscription();
    
    // Cleanup to prevent memory leaks
    return () => {
      initializingRef.current = false;
    };
  }, [user?.id, checkSubscription]); // Depend on checkSubscription to get latest version

  const refreshSubscription = useCallback(async () => {
    await checkSubscription(false);
  }, [checkSubscription]);

  return {
    isSubscribed: subscriptionData?.subscribed || false,
    subscriptionTier: subscriptionData?.subscription_tier,
    subscriptionEnd: subscriptionData?.subscription_end,
    loading,
    refreshSubscription,
  };
};
