import { useEffect, useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isTokenExpired, GarminTokens } from '@/lib/garmin-oauth';

export const useTokenRefresh = () => {
  const [tokens, setTokens] = useState<GarminTokens | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  // Load tokens from database
  const loadTokens = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[useTokenRefresh] No authenticated user');
        setIsConnected(false);
        setTokens(null);
        return;
      }

      const { data: tokenData, error } = await supabase
        .from('garmin_tokens')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.log('[useTokenRefresh] No Garmin tokens found:', error.message);
        setIsConnected(false);
        setTokens(null);
        return;
      }

      if (tokenData?.access_token && tokenData?.expires_at) {
        const expiresAtMs = new Date(tokenData.expires_at).getTime();
        const garminTokens: GarminTokens = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.token_secret || '',
          expires_in: Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)),
          token_type: 'Bearer',
          expires_at: expiresAtMs,
          scope: ''
        };
        
        console.log('[useTokenRefresh] Tokens loaded from database:', {
          expires_at: new Date(garminTokens.expires_at).toISOString(),
          is_expired: isTokenExpired(garminTokens)
        });
        
        setTokens(garminTokens);
        setIsConnected(true);
      } else {
        console.log('[useTokenRefresh] Invalid token data in database');
        setIsConnected(false);
        setTokens(null);
      }
    } catch (error) {
      console.error('[useTokenRefresh] Error loading tokens:', error);
      setIsConnected(false);
      setTokens(null);
    }
  }, []);

  // Load tokens on mount
  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  console.log(`[useTokenRefresh] Hook initialized - Connected: ${isConnected}, Has tokens: ${!!tokens}`);
  console.log(`[useTokenRefresh] Current time: ${new Date().toISOString()}`);
  if (tokens) {
    console.log(`[useTokenRefresh] Token expires at: ${new Date(tokens.expires_at).toISOString()}`);
    console.log(`[useTokenRefresh] Token is expired: ${isTokenExpired(tokens)}`);
  }

  const refreshTokenSafely = useCallback(async () => {
    // Prevent concurrent refresh attempts
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    if (!tokens?.refresh_token) {
      console.warn('[useTokenRefresh] No refresh token available');
      return;
    }

    console.log('[useTokenRefresh] Starting automatic token refresh');
    console.log('[useTokenRefresh] Current token expires at:', new Date(tokens.expires_at).toISOString());
    console.log('[useTokenRefresh] Time until expiry (minutes):', Math.round((tokens.expires_at - Date.now()) / 1000 / 60));
    
    refreshPromiseRef.current = (async () => {
      try {
        // Call the garmin-oauth edge function to refresh the token
        console.log('[useTokenRefresh] Invoking garmin-oauth function for token refresh');
        const { data, error } = await supabase.functions.invoke('garmin-oauth', {
          body: {
            refresh_token: tokens.refresh_token,
            grant_type: 'refresh_token'
          }
        });

        if (error) {
          console.error('[useTokenRefresh] Token refresh failed - Error object:', error);
          console.error('[useTokenRefresh] Error details:', JSON.stringify(error, null, 2));
          return;
        }

        if (!data || !data.success) {
          console.error('[useTokenRefresh] Token refresh failed - Invalid response:', data);
          return;
        }

        console.log('[useTokenRefresh] Automatic token refresh successful');
        console.log('[useTokenRefresh] Refresh response:', data);
        
        // Wait a moment for the database to be updated
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reload tokens from database
        await loadTokens();
      } catch (error) {
        console.error('[useTokenRefresh] Automatic token refresh failed - Exception:', error);
        console.error('[useTokenRefresh] Exception details:', error instanceof Error ? error.message : String(error));
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [tokens, loadTokens]);

  const scheduleTokenRefresh = useCallback((tokens: GarminTokens) => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Calculate time until token expires (with 10 minute buffer)
    const timeUntilExpiry = tokens.expires_at - Date.now() - (10 * 60 * 1000); // 10 min buffer
    
    // Don't schedule if token is already expired or expires too soon
    if (timeUntilExpiry <= 0) {
      console.log('[useTokenRefresh] Token already expired, triggering immediate refresh');
      refreshTokenSafely();
      return;
    }

    console.log(`[useTokenRefresh] Scheduling token refresh in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes`);
    
    // Schedule refresh
    refreshIntervalRef.current = setTimeout(() => {
      refreshTokenSafely();
    }, timeUntilExpiry);
  }, [refreshTokenSafely]);

  // Set up automatic token refresh when tokens change
  useEffect(() => {
    console.log(`[useTokenRefresh] Effect triggered - Connected: ${isConnected}, Tokens:`, tokens ? {
      expires_at: new Date(tokens.expires_at).toISOString(),
      expires_in_minutes: Math.round((tokens.expires_at - Date.now()) / 1000 / 60),
      is_expired: isTokenExpired(tokens),
      current_time: new Date().toISOString()
    } : 'null');

    if (!isConnected || !tokens) {
      console.log('[useTokenRefresh] Not connected or no tokens, clearing refresh interval');
      // Clear any existing refresh when disconnected
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    // If token is already expired, refresh immediately
    if (isTokenExpired(tokens)) {
      console.log('[useTokenRefresh] Token is expired, refreshing immediately');
      refreshTokenSafely();
    } else {
      console.log('[useTokenRefresh] Token is valid, scheduling refresh');
      // Schedule future refresh
      scheduleTokenRefresh(tokens);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [tokens, isConnected, scheduleTokenRefresh, refreshTokenSafely]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      refreshPromiseRef.current = null;
    };
  }, []);

  return {
    refreshTokenSafely
  };
};