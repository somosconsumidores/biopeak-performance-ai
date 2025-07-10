import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
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

const REDIRECT_URI = `${window.location.origin}/sync`;

export function useGarminAuth() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [tokens, setTokens] = useState<GarminTokens | null>(null);
  const { toast } = useToast();

  // Check for existing tokens on mount
  useEffect(() => {
    const storedTokens = getStoredTokens();
    if (storedTokens && !isTokenExpired(storedTokens)) {
      setTokens(storedTokens);
      setIsConnected(true);
    } else if (storedTokens && isTokenExpired(storedTokens)) {
      // Try to refresh the token
      refreshToken(storedTokens.refresh_token);
    }

    // Check if we're returning from OAuth callback
    const urlParams = parseCallbackParams(window.location.href);
    if (urlParams.code && urlParams.state) {
      handleOAuthCallback(urlParams.code, urlParams.state);
    }
  }, []);

  const startOAuthFlow = async () => {
    try {
      setIsConnecting(true);
      
      // Get client ID from edge function
      const { data: clientData, error: clientError } = await supabase.functions.invoke('garmin-oauth');
      if (clientError) throw clientError;
      
      const clientId = clientData.client_id;
      if (!clientId) throw new Error('Client ID not configured');
      
      // Generate PKCE parameters
      const { codeVerifier, codeChallenge } = await generatePKCE();
      const state = generateState();
      
      // Store PKCE data for later use
      storePKCEData({ codeVerifier, state });
      
      // Build authorization URL
      const authUrl = buildGarminAuthURL(
        clientId,
        REDIRECT_URI,
        codeChallenge,
        state
      );
      
      // Redirect to Garmin authorization
      window.location.href = authUrl;
    } catch (error) {
      console.error('OAuth flow error:', error);
      toast({
        title: 'Erro na conexão',
        description: 'Não foi possível iniciar a conexão com Garmin.',
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      const pkceData = getPKCEData();
      
      if (!pkceData || pkceData.state !== state) {
        throw new Error('Invalid state parameter');
      }
      
      // Exchange code for tokens via edge function
      const { data, error } = await supabase.functions.invoke('garmin-oauth', {
        body: {
          action: 'exchange_code',
          code,
          codeVerifier: pkceData.codeVerifier,
          redirectUri: REDIRECT_URI,
        },
      });

      if (error) throw error;

      // Store tokens and update state
      storeTokens(data);
      setTokens(data);
      setIsConnected(true);
      setIsConnecting(false);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      toast({
        title: 'Conectado com sucesso!',
        description: 'Sua conta Garmin foi conectada ao BioPeak.',
      });
    } catch (error) {
      console.error('OAuth callback error:', error);
      clearStoredTokens();
      setIsConnecting(false);
      
      toast({
        title: 'Erro na autenticação',
        description: 'Não foi possível conectar com Garmin. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const refreshToken = async (refreshTokenValue: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('garmin-oauth', {
        body: {
          action: 'refresh_token',
          refreshToken: refreshTokenValue,
        },
      });

      if (error) throw error;

      storeTokens(data);
      setTokens(data);
      setIsConnected(true);
    } catch (error) {
      console.error('Token refresh error:', error);
      disconnect();
    }
  };

  const disconnect = () => {
    clearStoredTokens();
    setTokens(null);
    setIsConnected(false);
    
    toast({
      title: 'Desconectado',
      description: 'Sua conta Garmin foi desconectada.',
    });
  };

  const getValidAccessToken = async (): Promise<string | null> => {
    if (!tokens) return null;
    
    if (isTokenExpired(tokens)) {
      await refreshToken(tokens.refresh_token);
      const refreshedTokens = getStoredTokens();
      return refreshedTokens?.access_token || null;
    }
    
    return tokens.access_token;
  };

  return {
    isConnected,
    isConnecting,
    tokens,
    startOAuthFlow,
    disconnect,
    getValidAccessToken,
  };
}