import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  generatePKCE, 
  generateState, 
  buildGarminAuthURL, 
  parseCallbackParams,
  storeTokens,
  getStoredTokens,
  clearStoredTokens,
  storePKCEData,
  getPKCEData,
  isTokenExpired,
  type GarminTokens
} from '@/lib/garmin-oauth';
import { useToast } from '@/hooks/use-toast';

const REDIRECT_URI = `${window.location.origin}/garmin-callback`;

export const useGarminAuth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [tokens, setTokens] = useState<GarminTokens | null>(null);
  const { toast } = useToast();

  // Check for existing tokens on mount
  useEffect(() => {
    const checkExistingTokens = async () => {
      try {
        console.log('[useGarminAuth] Checking for existing tokens...');
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[useGarminAuth] Current user:', user ? `ID: ${user.id}` : 'No user');
        if (!user) {
          console.log('[useGarminAuth] No authenticated user');
          return;
        }

        // Check database for tokens
        console.log('[useGarminAuth] Querying garmin_tokens for user:', user.id);
        const { data: dbTokens, error } = await supabase
          .from('garmin_tokens')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('[useGarminAuth] Database query result:', { dbTokens, error });

        if (error && error.code !== 'PGRST116') {
          console.error('[useGarminAuth] Error checking database tokens:', error);
          return;
        }

        if (dbTokens) {
          console.log('[useGarminAuth] Found tokens in database');
          
          // Check if tokens are expired
          const expiresAt = new Date(dbTokens.expires_at || 0).getTime();
          const isExpired = Date.now() >= expiresAt;
          
          if (!isExpired) {
            // Convert database tokens to GarminTokens format
            const garminTokens: GarminTokens = {
              access_token: dbTokens.access_token,
              refresh_token: dbTokens.token_secret || '',
              expires_in: Math.floor((expiresAt - Date.now()) / 1000),
              token_type: 'Bearer',
              expires_at: expiresAt,
              scope: ''
            };
            
            setTokens(garminTokens);
            setIsConnected(true);
            
            // Also store in localStorage for backwards compatibility
            storeTokens({
              access_token: garminTokens.access_token,
              refresh_token: garminTokens.refresh_token,
              expires_in: garminTokens.expires_in,
              token_type: garminTokens.token_type,
              scope: garminTokens.scope
            });
            
            console.log('[useGarminAuth] Tokens are valid, user is connected');
          } else {
            console.log('[useGarminAuth] Tokens are expired');
            // Clean up expired tokens
            await supabase
              .from('garmin_tokens')
              .delete()
              .eq('user_id', user.id);
            clearStoredTokens();
          }
        } else {
          console.log('[useGarminAuth] No tokens found in database');
          // Check localStorage as fallback
          const storedTokens = getStoredTokens();
          if (storedTokens && !isTokenExpired(storedTokens)) {
            setTokens(storedTokens);
            setIsConnected(true);
            console.log('[useGarminAuth] Using localStorage tokens');
          }
        }
      } catch (error) {
        console.error('[useGarminAuth] Error checking tokens:', error);
      }
    };

    checkExistingTokens();
  }, []);

  const startOAuthFlow = useCallback(async () => {
    try {
      setIsConnecting(true);
      console.log('[useGarminAuth] Starting OAuth flow...');

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[useGarminAuth] OAuth flow - Current user:', user ? `ID: ${user.id}` : 'No user');
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get client ID from edge function
      const { data: clientData, error: clientError } = await supabase.functions.invoke('garmin-oauth', {
        method: 'GET'
      });

      if (clientError) {
        console.error('[useGarminAuth] Error getting client ID:', clientError);
        throw new Error('Failed to get client configuration');
      }

      const clientId = clientData.client_id;
      console.log('[useGarminAuth] Got client ID:', clientId);

      // Generate PKCE parameters
      const { codeVerifier, codeChallenge } = await generatePKCE();
      const state = generateState();

      // Store PKCE data
      storePKCEData({ codeVerifier, state });
      console.log('[useGarminAuth] Generated and stored PKCE data');

      // Build authorization URL
      const authUrl = buildGarminAuthURL(clientId, REDIRECT_URI, codeChallenge, state);
      console.log('[useGarminAuth] Redirecting to:', authUrl);

      // Redirect to Garmin
      window.location.href = authUrl;
    } catch (error) {
      console.error('[useGarminAuth] Error starting OAuth flow:', error);
      toast({
        title: "Erro na conexão",
        description: error instanceof Error ? error.message : "Erro desconhecido ao iniciar conexão.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  }, [toast]);

  const handleOAuthCallback = useCallback(async (code: string, state: string) => {
    try {
      console.log('[useGarminAuth] Handling OAuth callback...');
      
      // Get current user and session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('User not authenticated');
      }

      // Verify state parameter
      const pkceData = getPKCEData();
      if (!pkceData || pkceData.state !== state) {
        throw new Error('Invalid state parameter');
      }

      console.log('[useGarminAuth] State verified, exchanging code for tokens...');

      // Exchange code for tokens via edge function with authentication
      const { data, error } = await supabase.functions.invoke('garmin-oauth', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: {
          code,
          codeVerifier: pkceData.codeVerifier,
          redirectUri: REDIRECT_URI,
        }
      });

      if (error) {
        console.error('[useGarminAuth] Edge function error:', error);
        throw new Error(error.message || 'Failed to exchange code for tokens');
      }

      if (!data.success) {
        console.error('[useGarminAuth] Token exchange failed:', data.error);
        throw new Error(data.error || 'Failed to exchange code for tokens');
      }

      console.log('[useGarminAuth] Token exchange successful');

      // Create tokens object
      const newTokens: GarminTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        token_type: data.token_type || 'Bearer',
        expires_at: Date.now() + (data.expires_in * 1000) - 600000, // 10 min buffer
        scope: data.scope || ''
      };

      // Store tokens and update state
      storeTokens(newTokens);
      setTokens(newTokens);
      setIsConnected(true);
      setIsConnecting(false);

      // Clear PKCE data
      localStorage.removeItem('garmin_pkce');

      console.log('[useGarminAuth] Authentication completed successfully');

      toast({
        title: "Conectado com sucesso!",
        description: "Sua conta Garmin Connect foi conectada.",
      });

      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error('[useGarminAuth] Error in OAuth callback:', error);
      setIsConnecting(false);
      toast({
        title: "Erro na conexão",
        description: error instanceof Error ? error.message : "Erro desconhecido durante a autenticação.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const disconnect = useCallback(async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Remove tokens from database
        await supabase
          .from('garmin_tokens')
          .delete()
          .eq('user_id', user.id);
      }

      // Clear localStorage
      clearStoredTokens();
      
      // Reset state
      setTokens(null);
      setIsConnected(false);
      
      toast({
        title: "Desconectado",
        description: "Sua conta Garmin Connect foi desconectada.",
      });
    } catch (error) {
      console.error('[useGarminAuth] Error disconnecting:', error);
      toast({
        title: "Erro",
        description: "Erro ao desconectar da conta Garmin.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    if (!tokens || isTokenExpired(tokens)) {
      // Try to refresh token
      if (tokens?.refresh_token) {
        try {
          await refreshToken(tokens.refresh_token);
          return tokens.access_token;
        } catch (error) {
          console.error('[useGarminAuth] Error refreshing token:', error);
          return null;
        }
      }
      return null;
    }
    return tokens.access_token;
  }, [tokens]);

  const refreshToken = useCallback(async (refreshTokenValue: string) => {
    try {
      console.log('[useGarminAuth] Refreshing token...');
      
      // Get current user and session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('User not authenticated');
      }

      // Call edge function to refresh token
      const { data, error } = await supabase.functions.invoke('garmin-oauth', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: {
          refresh_token: refreshTokenValue,
          grant_type: 'refresh_token'
        }
      });

      if (error || !data.success) {
        throw new Error(data?.error || 'Failed to refresh token');
      }

      const newTokens: GarminTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshTokenValue,
        expires_in: data.expires_in,
        token_type: data.token_type || 'Bearer',
        expires_at: Date.now() + (data.expires_in * 1000) - 600000,
        scope: data.scope || ''
      };

      storeTokens(newTokens);
      setTokens(newTokens);
      
      console.log('[useGarminAuth] Token refreshed successfully');
    } catch (error) {
      console.error('[useGarminAuth] Error refreshing token:', error);
      // If refresh fails, disconnect user
      await disconnect();
      throw error;
    }
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    tokens,
    startOAuthFlow,
    disconnect,
    getValidAccessToken,
    handleOAuthCallback,
  };
};