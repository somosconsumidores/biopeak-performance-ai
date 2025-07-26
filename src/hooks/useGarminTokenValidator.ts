import { useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useGarminTokenValidator = () => {
  const { user } = useAuth();

  const validateAndRefreshToken = useCallback(async () => {
    if (!user) return null;

    try {
      console.log('[useGarminTokenValidator] Checking Garmin token validity for user:', user.id.substring(0, 8) + '...');
      
      // Get current token
      const { data: tokenData, error: tokenError } = await supabase
        .from('garmin_tokens')
        .select('access_token, expires_at, token_secret')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tokenError || !tokenData) {
        console.log('[useGarminTokenValidator] No Garmin token found');
        return null;
      }

      const expiresAt = new Date(tokenData.expires_at);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      const minutesUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60));

      console.log('[useGarminTokenValidator] Token expires in:', minutesUntilExpiry, 'minutes');

      // If token expires in less than 10 minutes, proactively refresh
      if (minutesUntilExpiry < 10 && tokenData.token_secret) {
        console.log('[useGarminTokenValidator] Token expires soon, triggering proactive refresh');
        
        try {
          const { data, error } = await supabase.functions.invoke('garmin-oauth', {
            body: {
              refresh_token: tokenData.token_secret,
              grant_type: 'refresh_token'
            }
          });

          if (error) {
            console.error('[useGarminTokenValidator] Token refresh failed:', error);
            return null;
          }

          if (data && data.success) {
            console.log('[useGarminTokenValidator] Token refreshed successfully');
            return tokenData.access_token;
          } else {
            console.error('[useGarminTokenValidator] Token refresh response invalid:', data);
            return null;
          }
        } catch (refreshError) {
          console.error('[useGarminTokenValidator] Token refresh exception:', refreshError);
          return null;
        }
      }

      return tokenData.access_token;
    } catch (error) {
      console.error('[useGarminTokenValidator] Token validation error:', error);
      return null;
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      // Initial validation
      validateAndRefreshToken();

      // Set up periodic validation every 15 minutes
      const validationInterval = setInterval(() => {
        validateAndRefreshToken();
      }, 15 * 60 * 1000);

      return () => clearInterval(validationInterval);
    }
  }, [user, validateAndRefreshToken]);

  return { validateAndRefreshToken };
};