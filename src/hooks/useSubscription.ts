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
  
  // Get platform info directly without extra hook to avoid React queue issues
  const isIOS = Capacitor.getPlatform() === 'ios';
  const isNative = Capacitor.isNativePlatform();

  // Sync subscription status to Supabase in background
  const syncToSupabase = useCallback(async (data: SubscriptionData) => {
    try {
      const token = await getValidToken(supabase);
      if (!token) return;

      debugLog('📤 Syncing subscription to Supabase...');
      
      await supabase.functions.invoke('sync-subscription-status', {
        headers: { Authorization: `Bearer ${token}` },
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
        setSubscriptionData(cached);
        setLoading(false);
        checkingRef.current = false;
        
        // Still check RevenueCat in background to refresh cache
        setTimeout(() => {
          checkingRef.current = false;
          checkSubscription(false);
        }, 1000);
        return;
      }

      // Step 2: Check RevenueCat (iOS native only)
      if (isIOS && isNative) {
        try {
          debugLog('📱 Checking RevenueCat...');
          const rcData = await checkRevenueCatLight(user.id);
          
          debugLog('✅ RevenueCat result:', rcData);
          setSubscriptionData(rcData);
          cacheSubscription(rcData);
          
          // Sync to Supabase in background (non-blocking)
          syncToSupabase(rcData).catch(err => 
            debugError('Background sync failed:', err)
          );
          
          return;
        } catch (error) {
          debugWarn('⚠️ RevenueCat failed, falling back to Supabase:', error);
        }
      }

      // Step 3: Fallback to Supabase check
      debugLog('🔑 Getting fresh token for Supabase check...');
      const token = await getValidToken(supabase);
      
      if (!token) {
        debugError('❌ No valid token available');
        
        // Use old cache even if expired (offline mode)
        const oldCache = getCachedSubscription();
        if (oldCache) {
          debugWarn('⚠️ Using expired cache (offline mode)');
          setSubscriptionData(oldCache);
        } else {
          setSubscriptionData({ subscribed: false });
        }
        return;
      }

      debugLog('🌐 Calling quick-check-subscription...');
      const { data: quickData, error: quickError } = await supabase.functions.invoke(
        'quick-check-subscription',
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (quickError) throw quickError;

      debugLog('✅ Quick check result:', quickData);
      const finalData = quickData || { subscribed: false };
      
      setSubscriptionData(finalData);
      cacheSubscription(finalData);

    } catch (error) {
      debugError('❌ Subscription check failed:', error);
      
      // Use cached data if available (offline mode)
      const fallbackCache = getCachedSubscription();
      if (fallbackCache) {
        debugWarn('⚠️ Using cached data due to error');
        setSubscriptionData(fallbackCache);
      } else {
        setSubscriptionData({ subscribed: false });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      checkingRef.current = false;
      debugLog('✅ Subscription check complete');
    }
  }, [user, isIOS, isNative, syncToSupabase]);

  // Initialize on mount and user change
  useEffect(() => {
    if (initializingRef.current) return;
    
    const initialize = async () => {
      initializingRef.current = true;
      debugLog('🚀 Initializing subscription...');
      
      if (!user) {
        debugLog('👤 No user found');
        setSubscriptionData({ subscribed: false });
        setLoading(false);
        initializingRef.current = false;
        return;
      }

      await checkSubscription(false);
      initializingRef.current = false;
    };

    initialize();

    // Cleanup function
    return () => {
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
        setSubscriptionData({ subscribed: false });
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
