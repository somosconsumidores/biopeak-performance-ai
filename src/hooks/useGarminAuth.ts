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

const REDIRECT_URI = `${window.location.origin}/garmin-callback`;

export function useGarminAuth() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [tokens, setTokens] = useState<GarminTokens | null>(null);
  const { toast } = useToast();

  // Check for existing tokens on mount
  useEffect(() => {
    console.log('🔍 useGarminAuth useEffect triggered');
    console.log('🔍 Current URL:', window.location.href);
    
    const storedTokens = getStoredTokens();
    console.log('🔍 Stored tokens:', storedTokens ? 'exist' : 'not found');
    
    if (storedTokens && !isTokenExpired(storedTokens)) {
      console.log('✅ Valid tokens found, setting connected state');
      setTokens(storedTokens);
      setIsConnected(true);
    } else if (storedTokens && isTokenExpired(storedTokens)) {
      console.log('⏰ Tokens expired, trying to refresh');
      // Try to refresh the token
      refreshToken(storedTokens.refresh_token);
    }

    // Only process OAuth callback if we're on the callback page
    if (window.location.pathname === '/garmin-callback') {
      // Check if we're returning from OAuth callback
      const urlParams = parseCallbackParams(window.location.href);
      console.log('🔍 URL params:', urlParams);
      
      if (urlParams.code && urlParams.state) {
        console.log('🔄 OAuth callback detected, handling...');
        handleOAuthCallback(urlParams.code, urlParams.state);
      } else {
        console.log('ℹ️ No OAuth callback params found');
      }
    }
  }, []);

  const startOAuthFlow = async () => {
    try {
      setIsConnecting(true);
      console.log('🚀 Starting OAuth flow...');
      
      // Get client ID from edge function
      console.log('📞 Calling garmin-oauth edge function...');
      const { data: clientData, error: clientError } = await supabase.functions.invoke('garmin-oauth', {
        method: 'GET'
      });
      console.log('📨 Edge function response:', { clientData, clientError });
      
      if (clientError) {
        console.error('❌ Edge function error:', clientError);
        throw new Error(`Erro na edge function: ${clientError.message || JSON.stringify(clientError)}`);
      }
      
      const clientId = clientData?.client_id;
      console.log('🔑 Client ID received:', clientId);
      if (!clientId) throw new Error('Client ID not configured in edge function');
      
      // Generate PKCE parameters
      console.log('🔐 Generating PKCE parameters...');
      const { codeVerifier, codeChallenge } = await generatePKCE();
      const state = generateState();
      console.log('✅ PKCE generated - Challenge:', codeChallenge.substring(0, 10) + '...', 'State:', state.substring(0, 10) + '...');
      
      // Store PKCE data for later use
      console.log('💾 Storing PKCE data...');
      storePKCEData({ codeVerifier, state });
      
      // Build authorization URL
      console.log('🔗 Building authorization URL...');
      const authUrl = buildGarminAuthURL(
        clientId,
        REDIRECT_URI,
        codeChallenge,
        state
      );
      console.log('🌐 Authorization URL built:', authUrl);
      
      // Redirect to Garmin authorization
      console.log('🔄 Redirecting to Garmin...');
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
      console.log('🔄 handleOAuthCallback called with:', { code: code.substring(0, 10) + '...', state: state.substring(0, 10) + '...' });
      
      const pkceData = getPKCEData();
      console.log('🔍 PKCE data:', pkceData ? 'found' : 'not found');
      
      if (!pkceData || pkceData.state !== state) {
        console.error('❌ State validation failed:', { stored: pkceData?.state, received: state });
        throw new Error('Invalid state parameter');
      }
      
      console.log('✅ State validation passed');
      console.log('🔄 Calling edge function to exchange code for tokens...');
      
      // Exchange code for tokens via edge function
      const { data, error } = await supabase.functions.invoke('garmin-oauth', {
        body: JSON.stringify({
          code,
          codeVerifier: pkceData.codeVerifier,
          redirectUri: REDIRECT_URI,
        }),
      });

      console.log('🔍 Edge function response:', { data: data ? 'received' : 'null', error });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw error;
      }

      if (!data) {
        console.error('❌ No data received from edge function');
        throw new Error('No data received from token exchange');
      }

      console.log('✅ Tokens received, storing...');
      
      // Store tokens and update state
      storeTokens(data);
      setTokens(data);
      setIsConnected(true);
      setIsConnecting(false);
      
      console.log('✅ Connection state updated to connected');
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      toast({
        title: 'Conectado com sucesso!',
        description: 'Sua conta Garmin foi conectada ao BioPeak.',
      });
    } catch (error) {
      console.error('❌ OAuth callback error:', error);
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
        body: JSON.stringify({
          action: 'refresh_token',
          refreshToken: refreshTokenValue,
        }),
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
    handleOAuthCallback, // Export this function for the callback page
  };
}