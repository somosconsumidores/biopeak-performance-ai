import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StravaConfig {
  clientId: string;
  redirectUri: string;
}

export const useStravaAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleStravaConnect = async () => {
    setIsLoading(true);
    
    try {
      console.log('[StravaAuth] Initiating Strava connection...');
      
      // 1. Get Strava configuration
      const { data: configData, error: configError } = await supabase.functions.invoke('strava-config');
      
      console.log('[StravaAuth] Config response:', { configData, configError });
      
      if (configError || !configData) {
        toast({
          title: "Erro de configuração",
          description: "Não foi possível obter a configuração do Strava",
          variant: "destructive",
        });
        return;
      }

      const config: StravaConfig = configData;
      
      // 2. Build authorization URL with enhanced security
      const scope = 'read,activity:read_all';
      const responseType = 'code';
      const state = crypto.randomUUID();
      const timestamp = Date.now().toString();
      const stateWithTimestamp = `${state}:${timestamp}`;
      
      const authUrl = new URL('https://www.strava.com/oauth/authorize');
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('response_type', responseType);
      authUrl.searchParams.set('redirect_uri', config.redirectUri);
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('state', stateWithTimestamp);
      authUrl.searchParams.set('approval_prompt', 'force');
      
      console.log('[StravaAuth] Authorization URL:', authUrl.toString());
      console.log('[StravaAuth] Redirect URI being used:', config.redirectUri);
      
      // Store state and redirect URI in localStorage for validation on return
      try {
        localStorage.setItem('strava_oauth_state', stateWithTimestamp);
        localStorage.setItem('strava_oauth_redirect_uri', config.redirectUri);
        
        // Verify storage immediately
        const storedState = localStorage.getItem('strava_oauth_state');
        const storedRedirectUri = localStorage.getItem('strava_oauth_redirect_uri');
        
        console.log('[StravaAuth] Generated and stored state:', stateWithTimestamp);
        console.log('[StravaAuth] Verification - stored state:', storedState);
        console.log('[StravaAuth] Verification - stored redirect URI:', storedRedirectUri);
        
        if (!storedState || !storedRedirectUri) {
          throw new Error('Failed to store OAuth state in localStorage');
        }
      } catch (storageError) {
        console.error('[StravaAuth] localStorage error:', storageError);
        toast({
          title: "Erro de armazenamento",
          description: "Não foi possível salvar o estado OAuth. Verifique se o localStorage está habilitado.",
          variant: "destructive",
        });
        return;
      }
      
      // 3. Redirect to Strava authorization
      window.location.href = authUrl.toString();
      
    } catch (error) {
      console.error('Strava connect error:', error);
      toast({
        title: "Erro na conexão",
        description: "Erro inesperado ao conectar com o Strava",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallback = async (code: string, state: string): Promise<boolean> => {
    try {
      console.log('[StravaAuth] Callback received - state:', state);
      
      // Validate state parameter with detailed debugging
      let storedState;
      try {
        storedState = localStorage.getItem('strava_oauth_state');
        console.log('[StravaAuth] Stored state from localStorage:', storedState);
        console.log('[StravaAuth] Received state from URL:', state);
        console.log('[StravaAuth] localStorage available:', typeof Storage !== 'undefined');
        console.log('[StravaAuth] Current domain:', window.location.origin);
        
        // Check all localStorage items for debugging
        const allItems = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          allItems.push({ key, value: localStorage.getItem(key) });
        }
        console.log('[StravaAuth] All localStorage items:', allItems);
        
      } catch (storageError) {
        console.error('[StravaAuth] localStorage access error:', storageError);
      }
      
      if (!storedState) {
        console.error('[StravaAuth] No stored state found!');
        toast({
          title: "Erro de segurança",
          description: "Estado OAuth não encontrado. Tente conectar novamente.",
          variant: "destructive",
        });
        return false;
      }
      
      // Parse state with timestamp validation
      const [storedStateValue, storedTimestamp] = storedState.split(':');
      const [receivedStateValue, receivedTimestamp] = state.split(':');
      
      console.log('[StravaAuth] State validation details:', {
        storedStateValue,
        storedTimestamp,
        receivedStateValue,
        receivedTimestamp,
        statesMatch: storedStateValue === receivedStateValue,
        timestampsMatch: storedTimestamp === receivedTimestamp
      });
      
      if (storedStateValue !== receivedStateValue || storedTimestamp !== receivedTimestamp) {
        console.error('[StravaAuth] State validation failed!');
        toast({
          title: "Erro de segurança",
          description: "Estado OAuth inválido",
          variant: "destructive",
        });
        return false;
      }

      // Check timestamp (10 minutes expiry)
      const timestamp = parseInt(storedTimestamp);
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;
      
      if (now - timestamp > tenMinutes) {
        console.error('[StravaAuth] OAuth state expired!');
        toast({
          title: "Erro de segurança",
          description: "Estado OAuth expirado",
          variant: "destructive",
        });
        return false;
      }
      
      // Clear stored state
      localStorage.removeItem('strava_oauth_state');
      
      // Get stored redirect URI
      const storedRedirectUri = localStorage.getItem('strava_oauth_redirect_uri');
      if (!storedRedirectUri) {
        console.error('[StravaAuth] No redirect URI found!');
        toast({
          title: "Erro de configuração",
          description: "Redirect URI não encontrado",
          variant: "destructive",
        });
        return false;
      }

      console.log('[StravaAuth] Using redirect URI for token exchange:', storedRedirectUri);
      
      // Exchange code for tokens
      const { data: authData, error: authError } = await supabase.functions.invoke('strava-auth', {
        body: {
          code,
          redirect_uri: storedRedirectUri
        }
      });
      
      if (authError || !authData?.success) {
        console.error('[StravaAuth] Token exchange error:', authError);
        toast({
          title: "Falha na autenticação",
          description: authError?.message || "Não foi possível autenticar com o Strava",
          variant: "destructive",
        });
        return false;
      }

      console.log('[StravaAuth] Authentication successful:', authData);
      
      // Clean up stored redirect URI
      localStorage.removeItem('strava_oauth_redirect_uri');

      toast({
        title: "Conectado com sucesso!",
        description: `Bem-vindo, ${authData.athlete?.firstname || 'atleta'}!`,
      });
      
      return true;
      
    } catch (error) {
      console.error('Strava callback error:', error);
      toast({
        title: "Erro no callback",
        description: "Erro inesperado durante a autenticação",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    handleStravaConnect,
    handleCallback,
    isLoading,
  };
};