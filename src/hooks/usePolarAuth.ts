import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from 'uuid';

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
        const hasTokens = tokens && tokens.length > 0;
        setIsConnected(hasTokens);
        
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

  const startPolarOAuth = async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // 1. Obter o client_id de forma segura via edge function
    const { data: configData, error: configError } = await supabase.functions.invoke('get-polar-config');

    if (configError || !configData?.client_id) {
      throw new Error('Erro ao obter configuração da Polar');
    }

    const polarClientId = configData.client_id;
    const redirectUri = `${window.location.origin}/polar-callback`;

    // 2. Criar token de verificação (state) e salvar no Supabase
    const state = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos

    const { error: tokenError } = await supabase.from('oauth_temp_tokens').insert({
      user_id: user.id,
      provider: 'polar',
      oauth_token: state,
      expires_at: expiresAt
    });

    if (tokenError) {
      throw new Error('Erro ao salvar token temporário');
    }

    // 3. Montar URL de autorização da Polar
    const url = new URL('https://flow.polar.com/oauth2/authorization');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', polarClientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'accesslink.read_all');
    url.searchParams.set('state', state);

    // 4. Redirecionar usuário para autenticar na Polar
    window.location.href = url.toString();
  };

  const startOAuthFlow = async () => {
    try {
      setIsConnecting(true);

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

      toast({
        title: "Redirecionando",
        description: "Você será redirecionado para a Polar para autorizar a conexão.",
      });

      // Add a small delay to show the toast
      setTimeout(async () => {
        try {
          await startPolarOAuth();
        } catch (error) {
          console.error('Error starting Polar OAuth flow:', error);
          toast({
            title: "Erro na conexão",
            description: error instanceof Error ? error.message : "Erro ao conectar com a Polar",
            variant: "destructive",
          });
          setIsConnecting(false);
        }
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
    startPolarOAuth,
    
    disconnect,
    checkPolarConnection,
    checkPolarHealth,
  };
};