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

  console.log('[GarminTokenManager] Hook initialized with user:', user ? user.id.substring(0, 8) + '...' : 'null');

  const loadTokens = useCallback(async () => {
    if (!user) return null;

    try {
      console.log('[GarminTokenManager] Loading tokens for user:', user.id.substring(0, 8) + '...');
      
      const { data: tokenData, error } = await supabase
        .from('garmin_tokens')
        .select('access_token, refresh_token, token_secret, expires_at, refresh_token_expires_at, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('[GarminTokenManager] Error loading tokens:', error);
        return null;
      }

      if (!tokenData) {
        console.log('[GarminTokenManager] No active tokens found');
        setIsConnected(false);
        return null;
      }

      // Handle legacy storage: extract refresh_token from token_secret if needed
      let refreshToken;
      if (tokenData.refresh_token) {
        // Check if refresh_token is base64 encoded
        try {
          const decodedToken = atob(tokenData.refresh_token);
          const tokenObject = JSON.parse(decodedToken);
          if (tokenObject.refreshTokenValue) {
            // It's a base64 encoded object, extract the real token
            refreshToken = tokenObject.refreshTokenValue;
          } else {
            // It's already the raw token
            refreshToken = tokenData.refresh_token;
          }
        } catch (error) {
          // If decoding fails, use as-is (probably already raw token)
          refreshToken = tokenData.refresh_token;
        }
      } else if (tokenData.token_secret) {
        try {
          const secretData = JSON.parse(tokenData.token_secret);
          refreshToken = secretData.refreshTokenValue;
        } catch (error) {
          console.error('[GarminTokenManager] Error parsing token_secret:', error);
          refreshToken = null;
        }
      } else {
        refreshToken = null;
      }

      const tokens: GarminTokens = {
        access_token: tokenData.access_token,
        refresh_token: refreshToken,
        expires_at: tokenData.expires_at,
        refresh_token_expires_at: tokenData.refresh_token_expires_at,
        is_active: tokenData.is_active
      };

      setTokens(tokens);
      setIsConnected(true);
      console.log('[GarminTokenManager] Tokens loaded successfully');
      return tokens;
    } catch (error) {
      console.error('[GarminTokenManager] Exception loading tokens:', error);
      return null;
    }
  }, [user]);

  const refreshTokenSafely = useCallback(async (): Promise<boolean> => {
    console.log('[GarminTokenManager] refreshTokenSafely called');
    
    const currentTokens = tokens;
    if (!user || !currentTokens || isRefreshing) {
      console.log('[GarminTokenManager] Cannot refresh: no user, tokens, or already refreshing', {
        hasUser: !!user,
        hasTokens: !!currentTokens,
        isRefreshing
      });
      return false;
    }

    if (!currentTokens.refresh_token) {
      console.error('[GarminTokenManager] No refresh token available');
      return false;
    }

    // Check if refresh token is expired
    const refreshExpiresAt = new Date(currentTokens.refresh_token_expires_at);
    if (refreshExpiresAt <= new Date()) {
      console.error('[GarminTokenManager] Refresh token expired, need re-authorization');
      toast({
        title: "Garmin Connection Expired",
        description: "Please reconnect your Garmin account in settings.",
        variant: "destructive"
      });
      return false;
    }

    setIsRefreshing(true);
    
    try {
      console.log('[GarminTokenManager] Refreshing access token...');
      
      const { data, error } = await supabase.functions.invoke('garmin-oauth', {
        body: {
          refresh_token: currentTokens.refresh_token,
          grant_type: 'refresh_token'
        }
      });

      if (error) {
        console.error('[GarminTokenManager] Token refresh failed:', error);
        return false;
      }

      if (data && data.success) {
        console.log('[GarminTokenManager] Token refreshed successfully');
        await loadTokens(); // Reload updated tokens
        return true;
      } else {
        console.error('[GarminTokenManager] Token refresh response invalid:', data);
        return false;
      }
    } catch (error) {
      console.error('[GarminTokenManager] Token refresh exception:', error);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [user, isRefreshing, loadTokens, toast]);

  const checkTokenExpiration = useCallback(async () => {
    const currentTokens = tokens;
    if (!currentTokens) {
      console.log('[GarminTokenManager] No tokens to check');
      return;
    }

    const now = new Date();
    const expiresAt = new Date(currentTokens.expires_at);
    const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));
    const secondsUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);

    console.log('[GarminTokenManager] Token status:', {
      expiresAt: currentTokens.expires_at,
      minutesUntilExpiry,
      secondsUntilExpiry,
      isExpired: secondsUntilExpiry <= 0
    });

    // Refresh if token expires in less than 10 minutes OR is already expired
    if (minutesUntilExpiry < 10 || secondsUntilExpiry <= 0) {
      console.log('[GarminTokenManager] Token needs refresh - triggering now');
      const success = await refreshTokenSafely();
      console.log('[GarminTokenManager] Refresh result:', success);
    }

    // Check refresh token expiration warning (7 days)
    if (currentTokens.refresh_token_expires_at) {
      const refreshExpiresAt = new Date(currentTokens.refresh_token_expires_at);
      const daysUntilRefreshExpiry = Math.floor((refreshExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilRefreshExpiry <= 7 && daysUntilRefreshExpiry > 0) {
        console.warn('[GarminTokenManager] Refresh token expires in', daysUntilRefreshExpiry, 'days');
        toast({
          title: "Garmin Connection Expiring Soon",
          description: `Your Garmin connection expires in ${daysUntilRefreshExpiry} days. Please reconnect in settings.`,
          variant: "destructive"
        });
      }
    }
  }, [refreshTokenSafely, toast]);

  // Initial load and periodic checks
  useEffect(() => {
    console.log('[GarminTokenManager] useEffect triggered with user:', user ? user.id.substring(0, 8) + '...' : 'null');
    
    if (user) {
      console.log('[GarminTokenManager] Starting token management for user');
      loadTokens();

      // Check token expiration more frequently - every minute for better responsiveness
      const interval = setInterval(async () => {
        console.log('[GarminTokenManager] Interval check triggered');
        // Always reload tokens first to ensure we have the latest data from database
        await loadTokens();
        checkTokenExpiration();
      }, 60 * 1000); // 1 minute

      console.log('[GarminTokenManager] Interval set up');
      return () => {
        console.log('[GarminTokenManager] Cleaning up interval');
        clearInterval(interval);
      };
    } else {
      console.log('[GarminTokenManager] No user, clearing tokens');
      setTokens(null);
      setIsConnected(false);
    }
  }, [user]); // REMOVED the problematic dependencies

  return {
    tokens,
    isConnected,
    isRefreshing,
    refreshTokenSafely,
    loadTokens,
    checkTokenExpiration
  };
};