import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PolarOAuth } from "@/lib/polar-oauth";

export const usePolarAuth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkPolarConnection();
  }, []);

  const checkPolarConnection = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsLoading(false);
        return;
      }

      const { data: tokens, error } = await supabase
        .from('polar_tokens')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking Polar connection:', error);
        setIsConnected(false);
      } else {
        setIsConnected(tokens && tokens.length > 0);
      }
    } catch (error) {
      console.error('Error in checkPolarConnection:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const checkPolarHealth = async () => {
    try {
      console.log('🩺 Checking Polar API health...');
      const { data, error } = await supabase.functions.invoke('polar-health-check');
      
      if (error) {
        console.error('Health check error:', error);
        setHealthStatus({ healthy: false, error: error.message });
        return false;
      }
      
      setHealthStatus(data);
      console.log('🩺 Health check result:', data);
      return data.healthy;
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus({ healthy: false, error: 'Health check failed' });
      return false;
    }
  };

  const startOAuthFlow = async () => {
    try {
      setIsConnecting(true);

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para conectar sua conta Polar.",
          variant: "destructive",
        });
        return;
      }

      // Check Polar API health first
      console.log('🔍 Checking Polar API health before OAuth...');
      const isHealthy = await checkPolarHealth();
      
      if (!isHealthy) {
        toast({
          title: "Serviço indisponível",
          description: "A API da Polar está temporariamente indisponível. Tente novamente em alguns minutos.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      // Get client ID from backend
      console.log('🔍 Getting Polar configuration...');
      const { data, error } = await supabase.functions.invoke('get-polar-config');
      
      if (error || !data?.client_id) {
        console.error('Config error:', error);
        toast({
          title: "Erro de configuração",
          description: "Configuração da Polar não encontrada. Contate o suporte.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      const redirectUri = PolarOAuth.getCallbackUrl();
      const state = crypto.randomUUID();

      console.log('🔍 Generated OAuth parameters:', {
        state,
        redirectUri,
        clientId: data.client_id,
        scope: 'accesslink.read_all'
      });

      console.log('🔍 Storing temporary OAuth state...');
      // Store temp state for verification
      const { error: stateError } = await supabase
        .from('oauth_temp_tokens')
        .insert({
          user_id: session.user.id,
          oauth_token: state,
          provider: 'polar',
          provider_type: 'polar',
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
        });

      if (stateError) {
        console.error('State storage error:', stateError);
        toast({
          title: "Erro interno",
          description: "Erro ao preparar autenticação. Tente novamente.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      // Store in session storage as backup
      PolarOAuth.storeAuthState({ state, redirectUri });

      const authUrl = PolarOAuth.generateAuthorizationUrl({
        clientId: data.client_id,
        redirectUri,
        scope: 'accesslink.read_all',
        state,
      });

      console.log('🚀 Redirecting to Polar OAuth:', {
        url: authUrl,
        redirectUri,
        state,
        scope: 'accesslink.read_all'
      });

      console.log('🚀 Redirecting to Polar OAuth...');
      toast({
        title: "Redirecionando",
        description: "Você será redirecionado para a Polar para autorizar a conexão.",
      });

      // Add a small delay to show the toast
      setTimeout(() => {
        window.location.href = authUrl;
      }, 1000);
      
    } catch (error) {
      console.error('Error starting Polar OAuth flow:', error);
      toast({
        title: "Erro na conexão",
        description: error instanceof Error ? error.message : "Erro ao conectar com a Polar",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('polar_tokens')
        .update({ is_active: false })
        .eq('user_id', session.user.id);

      if (error) {
        throw new Error(error.message);
      }

      setIsConnected(false);
      
      toast({
        title: "Desconectado",
        description: "Sua conta Polar foi desconectada com sucesso.",
      });
    } catch (error) {
      console.error('Error disconnecting Polar:', error);
      toast({
        title: "Erro ao desconectar",
        description: error instanceof Error ? error.message : "Erro ao desconectar da Polar",
        variant: "destructive",
      });
    }
  };

  return {
    isConnected,
    isConnecting,
    isLoading,
    healthStatus,
    startOAuthFlow,
    disconnect,
    checkPolarConnection,
    checkPolarHealth,
  };
};