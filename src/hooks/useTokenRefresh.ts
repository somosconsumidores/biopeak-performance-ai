import { useEffect, useCallback, useRef } from 'react';
import { useGarminAuth } from './useGarminAuth';
import { isTokenExpired, GarminTokens } from '@/lib/garmin-oauth';

export const useTokenRefresh = () => {
  const { tokens, refreshToken: refreshTokenFn, isConnected } = useGarminAuth();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  console.log(`[useTokenRefresh] Hook initialized - Connected: ${isConnected}, Has tokens: ${!!tokens}`);
  console.log(`[useTokenRefresh] Current time: ${new Date().toISOString()}`);
  if (tokens) {
    console.log(`[useTokenRefresh] Token expires at: ${new Date(tokens.expires_at).toISOString()}`);
    console.log(`[useTokenRefresh] Token is expired: ${isTokenExpired(tokens)}`);
  }

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
  }, []);

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
    
    refreshPromiseRef.current = (async () => {
      try {
        // The refresh_token from useGarminAuth is already the base64 encoded token_secret
        // We need to decode it to get the actual refresh token value
        const tokenData = JSON.parse(atob(tokens.refresh_token));
        const refreshTokenValue = tokenData.refreshTokenValue;
        
        if (!refreshTokenValue) {
          console.warn('[useTokenRefresh] No refresh token value found in token data');
          return;
        }
        
        await refreshTokenFn(refreshTokenValue);
        console.log('[useTokenRefresh] Automatic token refresh successful');
      } catch (error) {
        console.error('[useTokenRefresh] Automatic token refresh failed:', error);
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [tokens, refreshTokenFn]);

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