import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface StravaConfig {
  clientId: string;
  redirectUri: string;
}

export const useStravaAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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
      
      // Hybrid storage: localStorage + sessionStorage + database
      if (!user?.id) {
        toast({
          title: "Erro de autenticação",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      try {
        // 1. Store in multiple places for redundancy
        localStorage.setItem('strava_oauth_state', stateWithTimestamp);
        localStorage.setItem('strava_oauth_redirect_uri', config.redirectUri);
        
        sessionStorage.setItem('strava_oauth_state', stateWithTimestamp);
        sessionStorage.setItem('strava_oauth_redirect_uri', config.redirectUri);
        
        // 2. Store in database for cross-domain/cross-session persistence
        const { error: dbError } = await supabase
          .from('oauth_states')
          .upsert({
            user_id: user.id,
            provider: 'strava',
            state_value: stateWithTimestamp,
            redirect_uri: config.redirectUri
          });

        if (dbError) {
          console.warn('[StravaAuth] Database storage failed:', dbError);
          // Continue anyway, we have localStorage/sessionStorage
        }
        
        // Verify storage immediately
        const storedState = localStorage.getItem('strava_oauth_state');
        const sessionState = sessionStorage.getItem('strava_oauth_state');
        
        console.log('[StravaAuth] Generated and stored state:', stateWithTimestamp);
        console.log('[StravaAuth] localStorage state:', storedState);
        console.log('[StravaAuth] sessionStorage state:', sessionState);
        
        if (!storedState && !sessionState) {
          throw new Error('Failed to store OAuth state in any storage');
        }
      } catch (storageError) {
        console.error('[StravaAuth] Storage error:', storageError);
        toast({
          title: "Erro de armazenamento",
          description: "Não foi possível salvar o estado OAuth. Verifique se o armazenamento está habilitado.",
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
      
      if (!user?.id) {
        toast({
          title: "Erro de autenticação",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return false;
      }
      
      // Hybrid validation: try multiple storage sources
      let storedState: string | null = null;
      let storedRedirectUri: string | null = null;
      let validationSource = '';

      try {
        // 1. Try localStorage first
        storedState = localStorage.getItem('strava_oauth_state');
        storedRedirectUri = localStorage.getItem('strava_oauth_redirect_uri');
        
        if (storedState && storedRedirectUri) {
          validationSource = 'localStorage';
          console.log('[StravaAuth] Using localStorage for validation');
        } else {
          // 2. Try sessionStorage
          storedState = sessionStorage.getItem('strava_oauth_state');
          storedRedirectUri = sessionStorage.getItem('strava_oauth_redirect_uri');
          
          if (storedState && storedRedirectUri) {
            validationSource = 'sessionStorage';
            console.log('[StravaAuth] Using sessionStorage for validation');
          } else {
            // 3. Try database as fallback
            const { data: dbState } = await supabase
              .from('oauth_states')
              .select('state_value, redirect_uri')
              .eq('user_id', user.id)
              .eq('provider', 'strava')
              .gte('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (dbState) {
              storedState = dbState.state_value;
              storedRedirectUri = dbState.redirect_uri;
              validationSource = 'database';
              console.log('[StravaAuth] Using database for validation');
            }
          }
        }
        
        console.log('[StravaAuth] Validation details:', {
          source: validationSource,
          storedState,
          storedRedirectUri,
          receivedState: state
        });
        
      } catch (storageError) {
        console.error('[StravaAuth] Storage access error:', storageError);
      }
      
      if (!storedState || !storedRedirectUri) {
        console.error('[StravaAuth] No stored state found in any storage!');
        
        // Cleanup any partial states
        try {
          await supabase
            .from('oauth_states')
            .delete()
            .eq('user_id', user.id)
            .eq('provider', 'strava');
        } catch (cleanupError) {
          console.warn('[StravaAuth] Cleanup error:', cleanupError);
        }
        
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
      
      // Clear stored states from all sources
      localStorage.removeItem('strava_oauth_state');
      localStorage.removeItem('strava_oauth_redirect_uri');
      sessionStorage.removeItem('strava_oauth_state');
      sessionStorage.removeItem('strava_oauth_redirect_uri');
      
      // Cleanup database state
      try {
        await supabase
          .from('oauth_states')
          .delete()
          .eq('user_id', user.id)
          .eq('provider', 'strava')
          .eq('state_value', storedState);
      } catch (cleanupError) {
        console.warn('[StravaAuth] Database cleanup error:', cleanupError);
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