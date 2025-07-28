import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function PolarCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processando conexão com a Polar...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const state = searchParams.get('state');

      if (error) {
        throw new Error(`Polar authorization error: ${error}`);
      }

      if (!code) {
        throw new Error('No authorization code received from Polar');
      }

      console.log('Received authorization code, exchanging for token...');

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      // Verify state if provided
      if (state) {
        const { data: tempToken, error: tempError } = await supabase
          .from('oauth_temp_tokens')
          .select('*')
          .eq('oauth_token', state)
          .eq('user_id', session.user.id)
          .eq('provider_type', 'polar')
          .maybeSingle();

        if (tempError || !tempToken) {
          console.warn('State verification failed, but continuing...');
        }

        // Clean up temp token
        if (tempToken) {
          await supabase
            .from('oauth_temp_tokens')
            .delete()
            .eq('id', tempToken.id);
        }
      }

      // Exchange code for tokens via our edge function
      const { data, error: exchangeError } = await supabase.functions.invoke('polar-oauth', {
        body: {
          code,
          redirect_uri: `${window.location.origin}/polar-callback`,
        }
      });

      if (exchangeError) {
        throw new Error(`Token exchange failed: ${exchangeError.message}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Unknown error during token exchange');
      }

      console.log('Polar connection successful!');
      
      setStatus('success');
      setMessage('Conta Polar conectada com sucesso!');
      
      toast({
        title: "Conexão realizada",
        description: "Sua conta Polar foi conectada com sucesso. Redirecionando...",
      });

      // Redirect to sync page after a short delay
      setTimeout(() => {
        navigate('/sync');
      }, 2000);

    } catch (error) {
      console.error('Polar callback error:', error);
      
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Erro desconhecido na conexão');
      
      toast({
        title: "Erro na conexão",
        description: error instanceof Error ? error.message : "Erro ao conectar com a Polar",
        variant: "destructive",
      });
    }
  };

  const handleRetry = () => {
    navigate('/sync');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === 'processing' && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === 'success' && <CheckCircle className="h-5 w-5 text-success" />}
            {status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
            Conexão Polar
          </CardTitle>
          <CardDescription>
            {status === 'processing' && 'Conectando sua conta Polar...'}
            {status === 'success' && 'Conexão realizada com sucesso!'}
            {status === 'error' && 'Falha na conexão'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            {message}
          </p>
          
          {status === 'success' && (
            <div className="text-sm text-muted-foreground">
              Redirecionando em alguns segundos...
            </div>
          )}
          
          {status === 'error' && (
            <Button onClick={handleRetry} className="w-full">
              Tentar Novamente
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}