import { useEffect, useCallback, useState, useRef } from 'react';
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshInProgress = useRef(false);

  const loadTokens = useCallback(async () => {
    if (!user) {
      setTokens(null);
      setIsConnected(false);
      return null;
    }

    try {
      const { data: tokenData, error } = await supabase
        .from('garmin_tokens')
        .select('access_token, refresh_token, token_secret, expires_at, refresh_token_expires_at, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('[GarminTokenManager] Error loading tokens:', error);
        setTokens(null);
        setIsConnected(false);
        return null;
      }

      if (!tokenData) {
        setTokens(null);
        setIsConnected(false);
        return null;
      }

      // Handle legacy storage: extract refresh_token from token_secret if needed
      let refreshToken;
      if (tokenData.refresh_token) {
        refreshToken = tokenData.refresh_token;
      } else if (tokenData.token_secret) {
        try {
          const secretData = JSON.parse(tokenData.token_secret);
          refreshToken = secretData.refreshTokenValue;
        } catch (error) {
          refreshToken = null;
        }
      } else {
        refreshToken = null;
      }

      const newTokens: GarminTokens = {
        access_token: tokenData.access_token,
        refresh_token: refreshToken,
        expires_at: tokenData.expires_at,
        refresh_token_expires_at: tokenData.refresh_token_expires_at,
        is_active: tokenData.is_active
      };

      setTokens(newTokens);
      setIsConnected(true);
      return newTokens;
    } catch (error) {
      console.error('[GarminTokenManager] Exception loading tokens:', error);
      setTokens(null);
      setIsConnected(false);
      return null;
    }
  }, [user]);

  const refreshTokenSafely = useCallback(async (): Promise<boolean> => {
    // Prevent concurrent refresh attempts
    if (!user || !tokens || isRefreshing || refreshInProgress.current) {
      return false;
    }

    if (!tokens.refresh_token) {
      return false;
    }

    // Check if refresh token is expired
    const refreshExpiresAt = new Date(tokens.refresh_token_expires_at);
    if (refreshExpiresAt <= new Date()) {
      toast({
        title: "Garmin Connection Expired",
        description: "Please reconnect your Garmin account in settings.",
        variant: "destructive"
      });
      return false;
    }

    refreshInProgress.current = true;
    setIsRefreshing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('garmin-oauth', {
        body: {
          refresh_token: tokens.refresh_token,
          grant_type: 'refresh_token'
        }
      });

      if (error) {
        return false;
      }

      if (data && data.success) {
        await loadTokens(); // Reload updated tokens
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    } finally {
      setIsRefreshing(false);
      refreshInProgress.current = false;
    }
  }, [user, tokens, isRefreshing, loadTokens, toast]);

  const checkTokenExpiration = useCallback(async () => {
    if (!tokens) {
      return;
    }

    const now = new Date();
    const expiresAt = new Date(tokens.expires_at);
    const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));

    // Refresh if token expires in less than 10 minutes OR is already expired
    if (minutesUntilExpiry < 10) {
      await refreshTokenSafely();
    }

    // Check refresh token expiration warning (7 days)
    if (tokens.refresh_token_expires_at) {
      const refreshExpiresAt = new Date(tokens.refresh_token_expires_at);
      const daysUntilRefreshExpiry = Math.floor((refreshExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilRefreshExpiry <= 7 && daysUntilRefreshExpiry > 0) {
        toast({
          title: "Garmin Connection Expiring Soon",
          description: `Your Garmin connection expires in ${daysUntilRefreshExpiry} days. Please reconnect in settings.`,
          variant: "destructive"
        });
      }
    }
  }, [tokens, refreshTokenSafely, toast]);

  // Initial load effect
  useEffect(() => {
    if (user) {
      loadTokens();
    } else {
      setTokens(null);
      setIsConnected(false);
    }
  }, [user, loadTokens]);

  // Periodic token check effect
  useEffect(() => {
    if (user && tokens) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Set up periodic check every 2 minutes
      intervalRef.current = setInterval(async () => {
        await loadTokens();
        checkTokenExpiration();
      }, 2 * 60 * 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [user, tokens, loadTokens, checkTokenExpiration]);

  return {
    tokens,
    isConnected,
    isRefreshing,
    refreshTokenSafely,
    loadTokens,
    checkTokenExpiration
  };
};