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
  const checkingRef = useRef(false); // Prevent concurrent checks

  // Memoize checkSubscription with useCallback to prevent re-renders
  const checkSubscription = useCallback(async (background = false) => {
    if (!user) {
      setSubscriptionData({ subscribed: false });
      setLoading(false);
      return;
    }

    // Prevent concurrent checks
    if (checkingRef.current) {
      debugWarn('⚠️ Subscription check already in progress, skipping...');
      return;
    }

    checkingRef.current = true;

    try {
      if (!background) setLoading(true);
      
      // For iOS native, check RevenueCat first (with aggressive timeout)
      if (isIOS && isNative) {
        try {
          debugLog('🍎 iOS Native: Attempting RevenueCat check...');
          await Promise.race([
            revenueCat.initialize(user.id),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('RevenueCat initialization timeout')), 3000)
            )
          ]);
          
          const customerInfo = await Promise.race([
            revenueCat.getCustomerInfo(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('RevenueCat getCustomerInfo timeout')), 3000)
            )
          ]) as any;
          
          if (customerInfo?.entitlements?.active) {
            const activeEntitlements = Object.keys(customerInfo.entitlements.active);
            if (activeEntitlements.length > 0) {
              const entitlement = customerInfo.entitlements.active[activeEntitlements[0]];
              debugLog('✅ RevenueCat: Active subscription found', { tier: 'premium', expiration: entitlement.expirationDate });
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
              if (!background) setLoading(false);
              return;
            }
          }
          debugLog('⚠️ RevenueCat: No active entitlements found, falling back to server check');
        } catch (rcError) {
          debugError('❌ RevenueCat check failed, falling back to server check:', rcError);
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
        if (!background) {
          setSubscriptionData({ subscribed: false });
          setLoading(false);
        }
        return;
      }

      // PRIORITY 1: Try quick database check first (< 200ms)
      debugLog('🔍 Starting quick database check...');
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
          debugLog('✅ Quick check: Active subscription found in database', {
            tier: quickData.subscription_tier,
            end: quickData.subscription_end,
            userId: user.id
          });
          setSubscriptionData(quickData);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: quickData, timestamp: Date.now() }));
          sessionStorage.setItem(SESSION_SUBSCRIPTION_KEY, JSON.stringify(quickData));
          if (!background) setLoading(false);
          return;
        }
        
        debugLog('⚠️ Quick check: No active subscription in database, proceeding to full Stripe check');
      } catch (quickCheckError) {
        debugWarn('❌ Quick check failed, proceeding to full Stripe check', quickCheckError);
      }

      // PRIORITY 2: Full Stripe verification (only if quick check failed)
      debugLog('🔄 Starting full Stripe verification...');
      const invokeCheck = async (accessToken: string) =>
        Promise.race([
          supabase.functions.invoke('check-subscription', {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Function invoke timeout')), 15000)
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
        debugError('❌ Erro ao verificar assinatura via Stripe:', error);
        
        // CRITICAL: In background mode, don't reset to false
        if (background) {
          debugWarn('⚠️ Background check failed, keeping current subscription status');
          return;
        }
        
        // Fallback to database cache (CRITICAL for iOS when Stripe fails)
        debugLog('🔄 Attempting fallback to direct database query...');
        const { data: cachedData, error: dbError } = await Promise.race([
          supabase
            .from('subscribers')
            .select('*')
            .eq('user_id', user.id)
            .single(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Cache query timeout')), 3000)
          )
        ]) as any;
        
        if (cachedData && !dbError) {
          debugLog('✅ Database fallback: Found subscription record', {
            subscribed: cachedData.subscribed,
            tier: cachedData.subscription_tier,
            end: cachedData.subscription_end
          });
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
          debugError('❌ Database fallback failed, no subscription found', dbError);
          setSubscriptionData({ subscribed: false });
        }
      } else {
        debugLog('✅ Stripe verification successful', data);
        setSubscriptionData(data);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        
        if (data.subscribed) {
          sessionStorage.setItem(SESSION_SUBSCRIPTION_KEY, JSON.stringify(data));
        }
      }
    } catch (error) {
      debugError('Erro na verificação de assinatura:', error);
      
      if (!background) {
        setSubscriptionData({ subscribed: false });
      }
    } finally {
      checkingRef.current = false;
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
            debugLog('✅ Using cached session subscription data (valid)', sessionData);
            setSubscriptionData(sessionData);
            setLoading(false);
            initializingRef.current = false;
            // NO background verification - trust the session cache
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
            setTimeout(() => reject(new Error('DB query timeout')), 5000)
          )
        ]) as any;
        
        if (dbSub && dbSub.subscription_end && new Date(dbSub.subscription_end) > new Date()) {
          debugLog('✅ Fast DB check: Active subscription found', dbSub);
          const fastData = {
            subscribed: dbSub.subscribed,
            subscription_tier: dbSub.subscription_tier,
            subscription_end: dbSub.subscription_end
          };
          setSubscriptionData(fastData);
          sessionStorage.setItem(SESSION_SUBSCRIPTION_KEY, JSON.stringify(fastData));
          setLoading(false);
          initializingRef.current = false;
          // NO background verification - trust the DB data
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
