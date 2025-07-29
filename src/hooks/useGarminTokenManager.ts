import { useEffect, useCallback, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

interface GarminTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  refresh_token_expires_at: string;
  is_active: boolean;
}

export const useGarminTokenManager = (user: User | null) => {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<GarminTokens | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadTokens = useCallback(async () => {
    if (!user) return;

    try {
      const { data: tokenData, error } = await supabase
        .from('garmin_tokens')
        .select('access_token, refresh_token, token_secret, expires_at, refresh_token_expires_at, is_active')
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

      let refreshTokenValue = tokenData.refresh_token;
      if (!refreshTokenValue && tokenData.token_secret) {
        try {
          refreshTokenValue = JSON.parse(atob(tokenData.token_secret)).refreshTokenValue;
        } catch {
          // Keep it null if parsing fails
        }
      }

      const loadedTokens: GarminTokens = {
        access_token: tokenData.access_token,
        refresh_token: refreshTokenValue,
        expires_at: tokenData.expires_at,
        refresh_token_expires_at: tokenData.refresh_token_expires_at,
        is_active: tokenData.is_active,
      };

      setTokens(loadedTokens);
      setIsConnected(true);
    } catch (error) {
      console.error('[GarminTokenManager] Exception loading tokens:', error);
    }
  }, [user]);

  const refreshTokenSafely = useCallback(async () => {
    if (!user || !tokens || isRefreshing) {
      return false;
    }

    if (!tokens.refresh_token) {
      console.error('[GarminTokenManager] No refresh token available');
      return false;
    }

    const refreshExpiresAt = new Date(tokens.refresh_token_expires_at);
    if (refreshExpiresAt <= new Date()) {
      toast({
        title: 'Garmin Connection Expired',
        description: 'Please reconnect your Garmin account in settings.',
        variant: 'destructive',
      });
      return false;
    }

    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('garmin-oauth', {
        body: {
          refresh_token: tokens.refresh_token,
          grant_type: 'refresh_token',
        },
      });

      if (error || !data.success) {
        console.error('[GarminTokenManager] Token refresh failed:', error || data?.error);
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
  }, [user, tokens, isRefreshing, loadTokens, toast]);

  const checkTokenExpiration = useCallback(() => {
    if (!tokens) return;

    const now = new Date();
    const expiresAt = new Date(tokens.expires_at);
    const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / 60000;

    if (minutesUntilExpiry < 10) {
      refreshTokenSafely();
    }

    const refreshExpiresAt = new Date(tokens.refresh_token_expires_at);
    const daysUntilRefreshExpiry = (refreshExpiresAt.getTime() - now.getTime()) / 86400000;

    if (daysUntilRefreshExpiry <= 7 && daysUntilRefreshExpiry > 0) {
      toast({
        title: 'Garmin Connection Expiring Soon',
        description: `Your Garmin connection expires in ${Math.ceil(daysUntilRefreshExpiry)} days. Please reconnect in settings.`,
        variant: 'destructive',
      });
    }
  }, [tokens, refreshTokenSafely, toast]);

  // Initial load and periodic checks
  useEffect(() => {
    if (user) {
      loadTokens();

      const interval = setInterval(() => {
        checkTokenExpiration();
      }, 2 * 60 * 1000); // Check every 2 minutes

      return () => clearInterval(interval);
    } else {
      setTokens(null);
      setIsConnected(false);
    }
  }, [user, loadTokens, checkTokenExpiration]);

  return {
    tokens,
    isConnected,
    isRefreshing,
    refreshTokenSafely,
    loadTokens,
  };
};