import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PolarOAuth } from "@/lib/polar-oauth";

export const usePolarAuth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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

      // Get client ID from backend (we'll need to add an endpoint for this)
      const { data, error } = await supabase.functions.invoke('get-polar-config');
      
      if (error || !data?.client_id) {
        throw new Error('Configuração da Polar não encontrada');
      }

      const redirectUri = PolarOAuth.getCallbackUrl();
      const state = `user_${session.user.id}_${Date.now()}`;

      // Store temp state for verification
      await supabase
        .from('oauth_temp_tokens')
        .insert({
          oauth_token: state,
          user_id: session.user.id,
          provider: 'polar',
          provider_type: 'polar',
        });

      const authUrl = PolarOAuth.generateAuthorizationUrl({
        clientId: data.client_id,
        redirectUri,
        scope: 'accesslink.read_all',
        state,
      });

      window.location.href = authUrl;
      
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
    startOAuthFlow,
    disconnect,
    checkPolarConnection,
  };
};