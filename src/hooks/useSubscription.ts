import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string | null;
}

interface CachedData {
  data: SubscriptionData;
  timestamp: number;
}

const CACHE_KEY = 'subscription_cache_v2';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Simple cache functions
const getCached = (): SubscriptionData | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    
    const { data, timestamp }: CachedData = JSON.parse(raw);
    const isExpired = Date.now() - timestamp > CACHE_DURATION;
    const isSubscriptionExpired = data.subscription_end && new Date(data.subscription_end) < new Date();
    
    if (isExpired || isSubscriptionExpired) return null;
    return data;
  } catch {
    return null;
  }
};

const setCache = (data: SubscriptionData): void => {
  try {
    const payload: CachedData = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore cache errors
  }
};

const clearCache = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem('subscription_session_ios_v1');
    localStorage.removeItem('subscription_cache_ios_v1');
  } catch {
    // Ignore
  }
};

export const useSubscription = () => {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  
  const checkingRef = useRef(false);
  const isMountedRef = useRef(true);

  const checkSubscription = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setData({ subscribed: false });
      setLoading(false);
      return;
    }

    if (checkingRef.current) return;
    checkingRef.current = true;

    if (!forceRefresh) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      // 1. Check cache (unless forced refresh)
      if (!forceRefresh) {
        const cached = getCached();
        if (cached) {
          if (isMountedRef.current) {
            setData(cached);
            setLoading(false);
          }
          checkingRef.current = false;
          return;
        }
      }

      // 2. Direct Supabase query (no edge function)
      const { data: sub, error } = await supabase
        .from('subscribers')
        .select('subscribed, subscription_tier, subscription_end')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // 3. Validate expiration
      const now = new Date();
      const isActive = sub?.subscribed && 
        (!sub.subscription_end || new Date(sub.subscription_end) > now);

      const result: SubscriptionData = {
        subscribed: isActive || false,
        subscription_tier: sub?.subscription_tier,
        subscription_end: sub?.subscription_end
      };

      // 4. Cache and update state
      setCache(result);
      if (isMountedRef.current) {
        setData(result);
      }

    } catch (error) {
      console.error('Subscription check failed:', error);
      
      // Fallback: use expired cache if available (offline mode)
      const fallback = getCached();
      if (fallback?.subscribed && isMountedRef.current) {
        setData(fallback);
      } else if (isMountedRef.current) {
        setData({ subscribed: false });
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      checkingRef.current = false;
    }
  }, [user]);

  // Initialize on mount and user change
  useEffect(() => {
    isMountedRef.current = true;
    checkSubscription(false);
    
    return () => {
      isMountedRef.current = false;
    };
  }, [user?.id, checkSubscription]);

  // Listen for subscription updates via Realtime
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscribers',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          clearCache();
          checkSubscription(true);
        }
      )
      .subscribe();
    
    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, checkSubscription]);

  // Clear cache on logout
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearCache();
        if (isMountedRef.current) {
          setData({ subscribed: false });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    isSubscribed: data?.subscribed || false,
    subscriptionTier: data?.subscription_tier,
    subscriptionEnd: data?.subscription_end,
    loading,
    refreshing,
    refreshSubscription: () => checkSubscription(true),
  };
};
