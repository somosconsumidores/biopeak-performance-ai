import { useEffect, useCallback, useState, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

interface GarminTokenStatus {
  expires_at: string | null;
  refresh_token_expires_at: string | null;
  is_active: boolean;
}

export const useGarminTokenManager = (user: User | null) => {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<GarminTokenStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Use refs to break dependency cycles
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  
  const isRefreshingRef = useRef(isRefreshing);
  isRefreshingRef.current = isRefreshing;

  const loadTokens = useCallback(async () => {
    if (!user) return;

    try {
      const { data: tokenData, error } = await supabase
        .from('garmin_tokens')
        .select('expires_at, refresh_token_expires_at, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('[GarminTokenManager] Error loading tokens:', error);
        return;
      }

      if (!tokenData) {
        setTokens(null);
        setIsConnected(false);
        return;
      }

      const loadedTokens: GarminTokenStatus = {
        expires_at: tokenData.expires_at || null,
        refresh_token_expires_at: tokenData.refresh_token_expires_at || null,
        is_active: tokenData.is_active,
      };

      setTokens(loadedTokens);
      setIsConnected(true);
    } catch (error) {
      console.error('[GarminTokenManager] Exception loading tokens:', error);
    }
  }, [user]);

  const refreshTokenSafely = useCallback(async () => {
    if (!user || !tokensRef.current || isRefreshingRef.current) {
      return false;
    }

    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('renew-garmin-token', {
        body: {
          user_id: user.id,
        },
      });

      if (error) {
        console.error('[GarminTokenManager] Token refresh failed:', error);
        return false;
      }

      if (!data.success) {
        console.error('[GarminTokenManager] Token refresh failed:', data?.error);
        
        // Check for specific error cases
        if (data?.error?.includes('refresh token expired')) {
          toast({
            title: 'Garmin Connection Expired',
            description: 'Please reconnect your Garmin account in settings.',
            variant: 'destructive',
          });
        }
        return false;
      }

      await loadTokens(); // Reload updated tokens
      return true;
    } catch (error) {
      console.error('[GarminTokenManager] Token refresh exception:', error);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [user, loadTokens, toast]);

  const checkTokenExpiration = useCallback(() => {
    const currentTokens = tokensRef.current;
    if (!currentTokens) return;

    const now = new Date();
    if (!currentTokens.expires_at) return;
    const expiresAt = new Date(currentTokens.expires_at);
    const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / 60000;

    if (minutesUntilExpiry < 10) {
      refreshTokenSafely();
    }

    if (!currentTokens.refresh_token_expires_at) return;
    const refreshExpiresAt = new Date(currentTokens.refresh_token_expires_at);
    const daysUntilRefreshExpiry = (refreshExpiresAt.getTime() - now.getTime()) / 86400000;

    if (daysUntilRefreshExpiry <= 7 && daysUntilRefreshExpiry > 0) {
      toast({
        title: 'Garmin Connection Expiring Soon',
        description: `Your Garmin connection expires in ${Math.ceil(daysUntilRefreshExpiry)} days. Please reconnect in settings.`,
        variant: 'destructive',
      });
    }
  }, [refreshTokenSafely, toast]);

  // Initial load - only when user changes
  useEffect(() => {
    if (user) {
      loadTokens();
    } else {
      setTokens(null);
      setIsConnected(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Periodic token expiration checks - separate effect with stable ref
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      checkTokenExpiration();
    }, 2 * 60 * 1000); // Check every 2 minutes

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    tokens,
    isConnected,
    isRefreshing,
    refreshTokenSafely,
    loadTokens,
  };
};