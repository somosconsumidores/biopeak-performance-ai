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

  const checkSubscription = useCallback(async () => {
    if (!user) {
      debugLog('👤 No user, setting subscribed to false');
      setSubscriptionData({ subscribed: false });
      setLoading(false);
      return;
    }

    try {
      debugLog('🔍 Starting subscription check for user:', user.id);
      setLoading(true);

      // Get fresh token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        debugError('❌ No session token available');
        setSubscriptionData({ subscribed: false });
        setLoading(false);
        return;
      }

      debugLog('🔑 Token obtained, calling quick-check-subscription...');

      // Call quick-check first (fast database check)
      const { data: quickData, error: quickError } = await supabase.functions.invoke('quick-check-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (quickError) {
        debugError('❌ Quick check error:', quickError);
        throw quickError;
      }

      debugLog('✅ Quick check result:', quickData);

      if (quickData?.subscribed) {
        // Active subscription found
        const data = {
          subscribed: true,
          subscription_tier: quickData.subscription_tier,
          subscription_end: quickData.subscription_end,
        };
        
        debugLog('✅ Active subscription confirmed:', data);
        setSubscriptionData(data);
        
        // Cache the result
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        sessionStorage.setItem(SESSION_SUBSCRIPTION_KEY, JSON.stringify(data));
      } else {
        // No active subscription - call full check for Stripe sync
        debugLog('⚠️ No active subscription in quick check, calling full check...');
        
        const { data: fullData, error: fullError } = await supabase.functions.invoke('check-subscription', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (fullError) {
          debugError('❌ Full check error:', fullError);
          setSubscriptionData({ subscribed: false });
        } else {
          debugLog('✅ Full check result:', fullData);
          setSubscriptionData(fullData || { subscribed: false });
          
          if (fullData?.subscribed) {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: fullData, timestamp: Date.now() }));
            sessionStorage.setItem(SESSION_SUBSCRIPTION_KEY, JSON.stringify(fullData));
          }
        }
      }
    } catch (error) {
      debugError('❌ Subscription check failed:', error);
      setSubscriptionData({ subscribed: false });
    } finally {
      setLoading(false);
      debugLog('✅ Subscription check complete');
    }
  }, [user]);

  // Initialize subscription on mount and user change
  useEffect(() => {
    if (initializingRef.current) return;
    
    const initializeSubscription = async () => {
      initializingRef.current = true;
      debugLog('🚀 Initializing subscription check...');
      
      if (!user) {
        debugLog('👤 No user found');
        setSubscriptionData({ subscribed: false });
        setLoading(false);
        initializingRef.current = false;
        return;
      }

      // Check session cache first (valid for current session only)
      const sessionVerified = sessionStorage.getItem(SESSION_SUBSCRIPTION_KEY);
      if (sessionVerified) {
        try {
          const sessionData = JSON.parse(sessionVerified);
          
          if (sessionData.subscription_end && new Date(sessionData.subscription_end) < new Date()) {
            debugWarn('⚠️ Session subscription expired, checking server...');
            sessionStorage.removeItem(SESSION_SUBSCRIPTION_KEY);
          } else {
            debugLog('✅ Using valid session cache:', sessionData);
            setSubscriptionData(sessionData);
            setLoading(false);
            initializingRef.current = false;
            return;
          }
        } catch (e) {
          debugError('❌ Session cache error:', e);
          sessionStorage.removeItem(SESSION_SUBSCRIPTION_KEY);
        }
      }

      // No valid cache, perform server check
      await checkSubscription();
      initializingRef.current = false;
    };

    initializeSubscription();
    
    return () => {
      initializingRef.current = false;
    };
  }, [user?.id, checkSubscription]);

  const refreshSubscription = useCallback(async () => {
    debugLog('🔄 Manual refresh requested');
    await checkSubscription();
  }, [checkSubscription]);

  return {
    isSubscribed: subscriptionData?.subscribed || false,
    subscriptionTier: subscriptionData?.subscription_tier,
    subscriptionEnd: subscriptionData?.subscription_end,
    loading,
    refreshSubscription,
  };
};
