import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { debugLog, debugError, debugWarn } from '@/lib/debug';
import { cacheSubscription, getCachedSubscription, clearSubscriptionCache } from '@/lib/subscription/cache-ios';
import { getValidToken } from '@/lib/subscription/token';
import { checkRevenueCatLight } from '@/lib/subscription/revenuecat-ios';

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
        body: JSON.stringify({
          user_id: user?.id,
          platform: 'ios',
          subscribed: data.subscribed,
          expiration_date: data.subscription_end
        })
      });
      
      debugLog('✅ Subscription synced to Supabase');
    } catch (error) {
      debugError('❌ Failed to sync to Supabase:', error);
    }
  }, [user?.id]);

  // Main check function
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

      // Step 1: Check cache first (instant response)
      const cached = getCachedSubscription();
      if (cached && !isManualRefresh) {
        debugLog('✅ Using valid cache:', cached);
        if (isMountedRef.current) {
          setSubscriptionData(cached);
          setLoading(false);
        }
        checkingRef.current = false;
        
        // Fire-and-forget background refresh (no recursion)
        (async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!checkingRef.current && isMountedRef.current) {
            checkingRef.current = true;
            try {
              if (isIOSNative) {
                debugLog('🔄 Background refresh: checking RevenueCat...');
                const rcData = await Promise.race([
                  checkRevenueCatLight(user.id),
                  new Promise<SubscriptionData>((_, reject) => 
                    setTimeout(() => reject(new Error('RevenueCat timeout')), 3000)
                  )
                ]);
                if (isMountedRef.current) {
                  setSubscriptionData(rcData);
                  cacheSubscription(rcData);
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

      // Step 2: Check RevenueCat (iOS native only) with timeout
      if (isIOSNative) {
        try {
          debugLog('📱 Checking RevenueCat...');
          const rcData = await Promise.race([
            checkRevenueCatLight(user.id),
            new Promise<SubscriptionData>((_, reject) => 
              setTimeout(() => reject(new Error('RevenueCat timeout')), 3000)
            )
          ]);
          
          debugLog('✅ RevenueCat result:', rcData);
          if (isMountedRef.current) {
            setSubscriptionData(rcData);
            cacheSubscription(rcData);
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

      // Step 3: Fallback to Supabase direct query
      debugLog('🔑 Checking Supabase subscription...');
      
      try {
        const { data: subData, error: subError } = await supabase
          .from('subscribers')
          .select('subscription_type, subscription_tier, subscription_end, subscribed')
          .eq('user_id', user.id)
          .eq('subscribed', true)
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

        debugLog('✅ Supabase result:', finalData);
        
        if (isMountedRef.current) {
          setSubscriptionData(finalData);
          cacheSubscription(finalData);
        }
      } catch (supabaseError) {
        debugError('❌ Supabase check failed:', supabaseError);
        
        // Use old cache even if expired (offline mode)
        const oldCache = getCachedSubscription();
        if (oldCache) {
          debugWarn('⚠️ Using expired cache (offline mode)');
          if (isMountedRef.current) {
            setSubscriptionData(oldCache);
          }
        } else {
          debugWarn('⚠️ No cache available, setting to not subscribed');
          if (isMountedRef.current) {
            setSubscriptionData({ subscribed: false });
          }
        }
      }

    } catch (error) {
      debugError('❌ Subscription check failed:', error);
      
      // Use cached data if available (offline mode)
      const fallbackCache = getCachedSubscription();
      if (fallbackCache) {
        debugWarn('⚠️ Using cached data due to error');
        if (isMountedRef.current) {
          setSubscriptionData(fallbackCache);
        }
      } else {
        debugWarn('⚠️ Error with no cache available');
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
