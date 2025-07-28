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
      // 1. Get Strava configuration
      const { data: configData, error: configError } = await supabase.functions.invoke('strava-config');
      
      if (configError || !configData) {
        toast({
          title: "Erro de configuração",
          description: "Não foi possível obter a configuração do Strava",
          variant: "destructive",
        });
        return;
      }

      const config: StravaConfig = configData;
      
      // 2. Build authorization URL
      const scope = 'read,activity:read_all';
      const responseType = 'code';
      const state = crypto.randomUUID(); // Generate random state for security
      
      const authUrl = new URL('https://www.strava.com/oauth/authorize');
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('response_type', responseType);
      authUrl.searchParams.set('redirect_uri', config.redirectUri);
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('state', state);
      
      // Store state in localStorage for validation on return
      localStorage.setItem('strava_oauth_state', state);
      
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
      // Validate state parameter
      const storedState = localStorage.getItem('strava_oauth_state');
      if (state !== storedState) {
        toast({
          title: "Erro de segurança",
          description: "Estado OAuth inválido",
          variant: "destructive",
        });
        return false;
      }
      
      // Clear stored state
      localStorage.removeItem('strava_oauth_state');
      
      // Get current redirect URI
      const { data: configData } = await supabase.functions.invoke('strava-config');
      const redirectUri = configData?.redirectUri || `${window.location.origin}/strava`;
      
      // Exchange code for tokens
      const { data: authData, error: authError } = await supabase.functions.invoke('strava-auth', {
        body: {
          code,
          redirect_uri: redirectUri
        }
      });
      
      if (authError || !authData?.success) {
        toast({
          title: "Falha na autenticação",
          description: authError?.message || "Não foi possível autenticar com o Strava",
          variant: "destructive",
        });
        return false;
      }

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