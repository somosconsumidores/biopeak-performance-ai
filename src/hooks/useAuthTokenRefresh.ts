import { useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { useTokenRefresh } from './useTokenRefresh';

export const useAuthTokenRefresh = (user: User | null, loading: boolean) => {
  const { refreshTokenSafely } = useTokenRefresh();

  useEffect(() => {
    if (user && !loading) {
      console.log('[useAuthTokenRefresh] Initializing token refresh for user:', user.id.substring(0, 8) + '...');
      // Token refresh is handled automatically by useTokenRefresh hook
    } else {
      console.log('[useAuthTokenRefresh] No user or still loading, skipping token refresh initialization');
    }
  }, [user, loading]);

  // Return the refresh function in case manual refresh is needed
  return { refreshTokenSafely };
};