import { useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { useTokenRefresh } from './useTokenRefresh';

export const useAuthTokenRefresh = (user: User | null, loading: boolean) => {
  const { refreshTokenSafely } = useTokenRefresh();

  useEffect(() => {
    if (user && !loading) {
      console.log('[useAuthTokenRefresh] Initializing proactive token refresh for user:', user.id.substring(0, 8) + '...');
      
      // Set up periodic token check every 30 minutes
      const tokenCheckInterval = setInterval(() => {
        console.log('[useAuthTokenRefresh] Performing periodic token validity check');
        refreshTokenSafely();
      }, 30 * 60 * 1000); // 30 minutes

      // Initial token check
      setTimeout(() => {
        console.log('[useAuthTokenRefresh] Performing initial token validity check');
        refreshTokenSafely();
      }, 5000); // Wait 5 seconds after initialization

      return () => {
        clearInterval(tokenCheckInterval);
      };
    } else {
      console.log('[useAuthTokenRefresh] No user or still loading, skipping token refresh initialization');
    }
  }, [user, loading, refreshTokenSafely]);

  // Return the refresh function in case manual refresh is needed
  return { refreshTokenSafely };
};