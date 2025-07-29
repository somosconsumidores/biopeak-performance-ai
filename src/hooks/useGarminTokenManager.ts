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

interface RefreshState {
  lastAttempt: number;
  consecutiveFailures: number;
  lastRefreshSuccess: number;
}

export const useGarminTokenManager = (user: User | null) => {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<GarminTokens | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshStateRef = useRef<RefreshState>({
    lastAttempt: 0,
    consecutiveFailures: 0,
    lastRefreshSuccess: 0
  });

  // Rate limiting: minimum 2 minutes between refresh attempts
  const MIN_REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes
  // Exponential backoff: base delay increases with consecutive failures
  const getBackoffDelay = (failures: number) => Math.min(30 * 60 * 1000, Math.pow(2, failures) * 60 * 1000); // Max 30 minutes

  const loadTokens = useCallback(async () => {
    if (!user) return null;

    try {
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
      return tokens;
    } catch (error) {
      console.error('[GarminTokenManager] Exception loading tokens:', error);
      return null;
    }
  }, [user]);

  const refreshTokenSafely = useCallback(async (): Promise<boolean> => {
    const currentTokens = tokens;
    const now = Date.now();
    const refreshState = refreshStateRef.current;

    if (!user || !currentTokens || isRefreshing) {
      return false;
    }

    if (!currentTokens.refresh_token) {
      console.error('[GarminTokenManager] No refresh token available');
      return false;
    }

    // FASE 3: Circuit breaker - se muitas falhas consecutivas, pare por 1 hora
    if (refreshState.consecutiveFailures >= 5) {
      const hoursSinceLastAttempt = (now - refreshState.lastAttempt) / (1000 * 60 * 60);
      if (hoursSinceLastAttempt < 1) {
        console.log('[GarminTokenManager] Circuit breaker: too many failures, waiting 1 hour');
        return false;
      }
    }

    // FASE 3: Blacklist check - não tente refresh do token problemático
    const problematicToken = 'eyJyZWZyZXNoVG9rZW5WYWx1ZSI6ImZkYmI1NTNjLWYxOGMtNGU2OC1hNjQxLTE2OTExYTg1ODBlZiIsImdhcm1pbkd1aWQiOiIzOTkzYWEyMy03MGFiLTRjMzQtYTY3YS1mMWVkNjJkNjc5OTAifQ==';
    if (currentTokens.refresh_token === problematicToken) {
      console.error('[GarminTokenManager] BLOCKED: Attempted to refresh blacklisted token');
      toast({
        title: "Garmin Connection Invalid",
        description: "Please reconnect your Garmin account.",
        variant: "destructive",
      });
      return false;
    }

    // Rate limiting: Check minimum interval between attempts
    if (now - refreshState.lastAttempt < MIN_REFRESH_INTERVAL) {
      console.log('[GarminTokenManager] Rate limited: too soon since last attempt');
      return false;
    }

    // Exponential backoff: Check if we should wait longer due to consecutive failures
    if (refreshState.consecutiveFailures > 0) {
      const backoffDelay = getBackoffDelay(refreshState.consecutiveFailures);
      if (now - refreshState.lastAttempt < backoffDelay) {
        console.log(`[GarminTokenManager] Exponential backoff: waiting ${Math.floor((backoffDelay - (now - refreshState.lastAttempt)) / 1000)}s more`);
        return false;
      }
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

    refreshState.lastAttempt = now;
    setIsRefreshing(true);
    
    try {
      console.log('[GarminTokenManager] Refreshing access token...', {
        userId: user.id,
        tokenLength: currentTokens.refresh_token?.length,
        timestamp: new Date().toISOString()
      });
      
      const { data, error } = await supabase.functions.invoke('garmin-oauth', {
        body: {
          refresh_token: currentTokens.refresh_token,
          grant_type: 'refresh_token'
        }
      });

      if (error) {
        console.error('[GarminTokenManager] Token refresh failed:', error);
        
        // Check if it's an invalid refresh token error
        if (error.message?.includes('invalid_refresh_token') || 
            error.message?.includes('requires_reauth') ||
            error.message?.includes('blocked_token')) {
          console.log('[GarminTokenManager] Invalid refresh token detected, clearing tokens and forcing re-auth');
          
          // FASE 1: Limpar localStorage quando token é inválido
          localStorage.removeItem('garmin_tokens');
          localStorage.removeItem('garmin_pkce');
          localStorage.removeItem('garmin_auth_state');
          
          // Clear tokens from state
          setTokens(null);
          setIsConnected(false);
          refreshState.consecutiveFailures = 0; // Reset failures
          
          toast({
            title: "Garmin Connection Expired", 
            description: "Please reconnect your Garmin account in settings.",
            variant: "destructive"
          });
          return false;
        }
        
        refreshState.consecutiveFailures++;
        return false;
      }

      if (data && data.success) {
        console.log('[GarminTokenManager] Token refreshed successfully');
        refreshState.consecutiveFailures = 0; // Reset failure count on success
        refreshState.lastRefreshSuccess = now;
        await loadTokens(); // Reload updated tokens
        return true;
      } else {
        console.error('[GarminTokenManager] Token refresh response invalid:', data);
        refreshState.consecutiveFailures++;
        return false;
      }
    } catch (error) {
      console.error('[GarminTokenManager] Token refresh exception:', error);
      refreshState.consecutiveFailures++;
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [user, isRefreshing, loadTokens, toast]);

  const checkTokenExpiration = useCallback(async () => {
    const currentTokens = tokens;
    if (!currentTokens) {
      return;
    }

    const now = new Date();
    const expiresAt = new Date(currentTokens.expires_at);
    const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));

    // Only refresh if token expires in less than 5 minutes OR is already expired
    // This reduces unnecessary refresh attempts
    if (minutesUntilExpiry < 5) {
      console.log('[GarminTokenManager] Token needs refresh - expires in', minutesUntilExpiry, 'minutes');
      const success = await refreshTokenSafely();
      if (success) {
        console.log('[GarminTokenManager] Token refresh successful');
      }
    }

    // Check refresh token expiration warning (7 days) - only warn once per day
    if (currentTokens.refresh_token_expires_at) {
      const refreshExpiresAt = new Date(currentTokens.refresh_token_expires_at);
      const daysUntilRefreshExpiry = Math.floor((refreshExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilRefreshExpiry <= 7 && daysUntilRefreshExpiry > 0) {
        // Only show toast if we haven't shown it in the last 24 hours
        const lastWarning = localStorage.getItem('garmin_refresh_warning');
        const shouldWarn = !lastWarning || (now.getTime() - parseInt(lastWarning)) > 24 * 60 * 60 * 1000;
        
        if (shouldWarn) {
          localStorage.setItem('garmin_refresh_warning', now.getTime().toString());
          toast({
            title: "Garmin Connection Expiring Soon",
            description: `Your Garmin connection expires in ${daysUntilRefreshExpiry} days. Please reconnect in settings.`,
            variant: "destructive"
          });
        }
      }
    }
  }, [tokens, refreshTokenSafely, toast]);

  // DISABLED: useEffect causing infinite calls to garmin-oauth
  // This useEffect was causing continuous calls to garmin-oauth function
  // and needs to be completely refactored before re-enabling
  useEffect(() => {
    console.log('[GarminTokenManager] Hook initialized with user:', user ? user.id : 'null');
    console.log('[GarminTokenManager] useEffect triggered with user:', user ? user.id : 'null');
    
    if (!user) {
      console.log('[GarminTokenManager] No user, clearing tokens');
      setTokens(null);
      setIsConnected(false);
      localStorage.removeItem('garmin_tokens');
      localStorage.removeItem('garmin_pkce');
      localStorage.removeItem('garmin_auth_state');
      return;
    }
    
    // CRITICALLY DISABLED - this was causing the infinite loop
    // DO NOT RE-ENABLE without fixing the dependency array and token refresh logic
    console.log('[GarminTokenManager] User present but hook is DISABLED to prevent infinite calls');
  }, [user]);

  return {
    tokens,
    isConnected,
    isRefreshing,
    refreshTokenSafely,
    loadTokens,
    checkTokenExpiration
  };
};