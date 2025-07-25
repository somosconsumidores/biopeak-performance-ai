import { useEffect, useCallback, useRef } from 'react';
import { useGarminAuth } from './useGarminAuth';
import { isTokenExpired, GarminTokens } from '@/lib/garmin-oauth';

export const useTokenRefresh = () => {
  const { tokens, refreshToken: refreshTokenFn, isConnected } = useGarminAuth();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

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
        await refreshTokenFn(tokens.refresh_token);
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
    if (!isConnected || !tokens) {
      // Clear any existing refresh when disconnected
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    // If token is already expired, refresh immediately
    if (isTokenExpired(tokens)) {
      refreshTokenSafely();
    } else {
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