import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { debugLog, debugError, debugWarn } from '@/lib/debug';
import { cacheSubscription, getCachedSubscription, clearSubscriptionCache } from '@/lib/subscription/cache-ios';
import { getValidToken } from '@/lib/subscription/token';
import { checkRevenueCatLight } from '@/lib/subscription/revenuecat-ios';
import { detectSubscriptionSource, type SubscriptionSource } from '@/lib/subscription/detect-subscription-source';
import { checkSupabaseSubscription } from '@/lib/subscription/supabase-check';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string | null;
}

export const useSubscription = () => {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  
  const initializingRef = useRef(false);
  const checkingRef = useRef(false);
  const isMountedRef = useRef(true);
  
  // Get platform info directly without extra hook to avoid React queue issues
  const isIOSNative = Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform();

  // Sync subscription status to Supabase in background
  const syncToSupabase = useCallback(async (data: SubscriptionData) => {
    try {
      const token = await getValidToken(supabase);
      if (!token) return;

      debugLog('📤 Syncing subscription to Supabase...');
      
      await supabase.functions.invoke('sync-subscription-status', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: {
          user_id: user?.id,
          platform: 'ios',
          subscribed: data.subscribed,
          expiration_date: data.subscription_end
        }
      });
      
      debugLog('✅ Subscription synced to Supabase');
    } catch (error) {
      debugError('❌ Failed to sync to Supabase:', error);
    }
  }, [user?.id]);

  // Função helper para validação completa via edge function
  const checkFullSubscriptionStatus = useCallback(async () => {
    try {
      debugLog('📡 Calling check-subscription edge function...');
      const token = await getValidToken(supabase);
      if (!token) {
        debugWarn('⚠️ No valid token for full check');
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (error) {
        debugError('❌ Full check failed:', error);
        return;
      }
      
      if (data?.subscribed && isMountedRef.current) {
        debugLog('✅ Full check returned subscribed, updating state and cache');
        const fullData: SubscriptionData = {
          subscribed: data.subscribed,
          subscription_tier: data.subscription_tier,
          subscription_end: data.subscription_end
        };
        setSubscriptionData(fullData);
        cacheSubscription(fullData, 'stripe');
      }
    } catch (error) {
      debugError('❌ Full check exception:', error);
    }
  }, []);

  const checkSubscription = useCallback(async (isManualRefresh = false) => {
    if (!user) {
      debugLog('👤 No user, setting subscribed to false');
      setSubscriptionData({ subscribed: false });
      setLoading(false);
      return;
    }

    if (checkingRef.current) {
      debugWarn('⚠️ Check already in progress, skipping');
      return;
    }

    checkingRef.current = true;
    if (!isManualRefresh) setLoading(true);
    else setRefreshing(true);

    try {
      debugLog('🔍 Starting subscription check for user:', user.id);

      // Step 0: Detect subscription source (Stripe vs RevenueCat)
      const source: SubscriptionSource = await detectSubscriptionSource(user.id);
      debugLog('📍 Detected subscription source:', source);

      // If no source detected, run full unified check (Stripe + Stripe DB) and stop here
      if (source === 'none') {
        debugLog('🧪 No subscription source detected, running full Stripe verification via edge function');
        await checkFullSubscriptionStatus();
        return;
      }

      // Step 1: Check cache first (instant response) - validate source match
      const cached = getCachedSubscription(source === 'stripe' ? 'stripe' : source === 'revenuecat' ? 'revenuecat' : undefined);
      if (cached && !isManualRefresh) {
        debugLog('✅ Using valid cache:', cached);
        if (isMountedRef.current) {
          setSubscriptionData(cached);
          setLoading(false);
        }
        checkingRef.current = false;
        
        // Fire-and-forget background refresh (simple version)
        (async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!checkingRef.current && isMountedRef.current) {
            checkingRef.current = true;
            try {
              if (source === 'stripe') {
                debugLog('🔄 Background refresh: checking Supabase for Stripe subscriber...');
                const supabaseData = await checkSupabaseSubscription(user.id);
                if (isMountedRef.current && supabaseData.subscribed) {
                  setSubscriptionData(supabaseData);
                  cacheSubscription(supabaseData, 'stripe');
                }
              } else if (source === 'revenuecat' && isIOSNative) {
                debugLog('🔄 Background refresh: checking RevenueCat...');
                const rcData = await Promise.race([
                  checkRevenueCatLight(user.id),
                  new Promise<SubscriptionData>((_, reject) => 
                    setTimeout(() => reject(new Error('RevenueCat timeout')), 3000)
                  )
                ]);
                if (isMountedRef.current) {
                  setSubscriptionData(rcData);
                  cacheSubscription(rcData, 'revenuecat');
                  syncToSupabase(rcData).catch(err => 
                    debugError('Background sync failed:', err)
                  );
                }
              }
            } catch (error) {
              debugWarn('⚠️ Background refresh failed:', error);
            } finally {
              checkingRef.current = false;
            }
          }
        })();
        return;
      }

      // Step 2: SMART CHECK - Skip RevenueCat if user is Stripe subscriber  
      if (source === 'stripe') {
        debugLog('💳 User is Stripe subscriber, using direct Supabase check');
        
        try {
          const supabaseData = await checkSupabaseSubscription(user.id);
          debugLog('✅ Supabase result for Stripe subscriber:', supabaseData);
          
          if (isMountedRef.current) {
            setSubscriptionData(supabaseData);
            cacheSubscription(supabaseData, 'stripe');
          }
          return;
        } catch (error) {
          debugError('❌ Supabase check failed for Stripe subscriber:', error);
          // Continue to fallback logic below
        }
      }

      // Step 3: Check RevenueCat (iOS native only, and only if NOT a Stripe subscriber)
      if (isIOSNative && source === 'revenuecat') {
        try {
          debugLog('📱 Checking RevenueCat for RevenueCat subscriber...');
          const rcData = await Promise.race([
            checkRevenueCatLight(user.id),
            new Promise<SubscriptionData>((_, reject) => 
              setTimeout(() => reject(new Error('RevenueCat timeout')), 3000)
            )
          ]);
          
          debugLog('✅ RevenueCat result:', rcData);
          if (isMountedRef.current) {
            setSubscriptionData(rcData);
            cacheSubscription(rcData, 'revenuecat');
          }
          
          // Sync to Supabase in background (non-blocking)
          syncToSupabase(rcData).catch(err => 
            debugError('Background sync failed:', err)
          );
          
          return;
        } catch (error) {
          debugWarn('⚠️ RevenueCat failed, falling back to Supabase:', error);
        }
      }

      // Step 4: Fallback to Supabase direct query (for all cases)
      debugLog('🔑 Checking Supabase subscription (fallback)...');
      
      try {
        const { data: subData, error: subError } = await supabase
          .from('subscribers')
          .select('subscription_type, subscription_tier, subscription_end, subscribed')
          .eq('user_id', user.id)
          .maybeSingle();

        if (subError) {
          debugWarn('⚠️ Supabase query error:', subError);
          throw subError;
        }

        const now = new Date();
        const isActive = subData?.subscribed && 
          (!subData.subscription_end || new Date(subData.subscription_end) > now);

        const finalData: SubscriptionData = {
          subscribed: isActive || false,
          subscription_tier: subData?.subscription_tier,
          subscription_end: subData?.subscription_end
        };

        debugLog('✅ Supabase fallback result:', finalData);
        
        if (isMountedRef.current) {
          setSubscriptionData(finalData);
          // Cache with appropriate source
          const cacheSource = source === 'revenuecat' ? 'revenuecat' : 'stripe';
          cacheSubscription(finalData, cacheSource);
        }
      } catch (supabaseError) {
        debugError('❌ Supabase check failed:', supabaseError);
        
        // CRITICAL: Use old cache even if expired (offline mode) - maintain UX
        const oldCache = getCachedSubscription();
        if (oldCache && oldCache.subscribed) {
          debugWarn('⚠️ Using expired cache to maintain UX (offline mode)');
          if (isMountedRef.current) {
            setSubscriptionData(oldCache);
          }
        } else {
          debugWarn('⚠️ No valid cache available, setting to not subscribed');
          if (isMountedRef.current) {
            setSubscriptionData({ subscribed: false });
          }
        }
      }

    } catch (error) {
      debugError('❌ Subscription check failed:', error);
      
      // CRITICAL: Use cached data if available (offline mode) - maintain UX
      const fallbackCache = getCachedSubscription();
      if (fallbackCache && fallbackCache.subscribed) {
        debugWarn('⚠️ Using cached data to maintain UX during error');
        if (isMountedRef.current) {
          setSubscriptionData(fallbackCache);
        }
      } else {
        debugWarn('⚠️ Error with no valid cache available');
        if (isMountedRef.current) {
          setSubscriptionData({ subscribed: false });
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      checkingRef.current = false;
      debugLog('✅ Subscription check complete');
    }
  }, [user, isIOSNative, syncToSupabase]);

  // Forçar refresh completo após login (iOS)
  useEffect(() => {
    if (user && isIOSNative) {
      debugLog('🔄 iOS login detected, scheduling full subscription check...');
      const timeoutId = setTimeout(() => {
        checkFullSubscriptionStatus();
      }, 2000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [user?.id, isIOSNative, checkFullSubscriptionStatus]);

  // Initialize on mount and user change
  useEffect(() => {
    isMountedRef.current = true;
    
    if (initializingRef.current) return;
    
    const initialize = async () => {
      initializingRef.current = true;
      debugLog('🚀 Initializing subscription...');
      
      if (!user) {
        debugLog('👤 No user found');
        if (isMountedRef.current) {
          setSubscriptionData({ subscribed: false });
          setLoading(false);
        }
        initializingRef.current = false;
        return;
      }

      await checkSubscription(false);
      initializingRef.current = false;
    };

    initialize();

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      initializingRef.current = false;
      checkingRef.current = false;
    };
  }, [user?.id, checkSubscription]);

  // Listen for subscription updates via Realtime
  useEffect(() => {
    if (!user?.id) return;
    
    debugLog('🔔 Setting up Realtime listener for subscription updates');
    
    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'subscription_updates',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          debugLog('🔔 Subscription update received via Realtime:', payload);
          clearSubscriptionCache();
          checkSubscription(true);
        }
      )
      .subscribe((status) => {
        debugLog('📡 Realtime subscription status:', status);
      });
    
    return () => {
      debugLog('🔕 Unsubscribing from Realtime channel');
      channel.unsubscribe();
    };
  }, [user?.id, checkSubscription]);

  // Listen for auth changes to clear cache on logout
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        debugLog('👋 User signed out, clearing cache');
        clearSubscriptionCache();
        if (isMountedRef.current) {
          setSubscriptionData({ subscribed: false });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Manual refresh function
  const refreshSubscription = useCallback(async () => {
    debugLog('🔄 Manual refresh requested');
    await checkSubscription(true);
  }, [checkSubscription]);

  return {
    isSubscribed: subscriptionData?.subscribed || false,
    subscriptionTier: subscriptionData?.subscription_tier,
    subscriptionEnd: subscriptionData?.subscription_end,
    loading,
    refreshing,
    refreshSubscription,
  };
};
