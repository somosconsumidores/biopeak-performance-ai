import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Bug } from "lucide-react";
import { usePolarOAuthDebug } from "@/hooks/usePolarOAuthDebug";

export default function PolarCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processando conexão com a Polar...');
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const { debugInfo, runFullDiagnostics, logAuditTrail } = usePolarOAuthDebug();

  useEffect(() => {
    logAuditTrail('CALLBACK_STARTED', { url: window.location.href });
    handleCallback();
  }, []);

  const logOAuthDiagnostics = () => {
    console.log('🔍 POLAR OAUTH DIAGNOSTICS:');
    console.log(`🔍 Current URL: ${window.location.href}`);
    console.log(`🔍 Origin: ${window.location.origin}`);
    console.log(`🔍 Expected callback: ${window.location.origin}/polar-callback`);
    console.log(`🔍 User Agent: ${navigator.userAgent}`);
    console.log(`🔍 Timestamp: ${new Date().toISOString()}`);
    
    // Log all URL parameters
    const allParams = Array.from(searchParams.entries());
    console.log('🔍 All URL parameters:', Object.fromEntries(allParams));
  };

  const handleCallback = async () => {
    const startTime = Date.now();
    console.log('🔄 Starting Polar OAuth callback process...');
    
    // First, log comprehensive diagnostics
    logOAuthDiagnostics();
    
    try {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const state = searchParams.get('state');

      console.log('📨 URL parameters received:');
      console.log(`📨 Code: ${code ? 'YES' : 'NO'}`);
      console.log(`📨 Error: ${error || 'none'}`);
      console.log(`📨 State: ${state || 'none'}`);

      if (error) {
        console.error('❌ Polar authorization error:', error);
        await logAuditTrail('AUTHORIZATION_ERROR', { error });
        throw new Error(`Polar authorization error: ${error}`);
      }

      if (!code) {
        console.error('❌ No authorization code received');
        await logAuditTrail('MISSING_CODE', { allParams: Object.fromEntries(searchParams.entries()) });
        throw new Error('No authorization code received from Polar');
      }

      console.log('✅ Authorization code received, proceeding with token exchange...');

      // Get current user
      console.log('🔍 Getting current user session...');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('❌ User not authenticated');
        throw new Error('User not authenticated');
      }
      console.log(`✅ User authenticated: ${session.user.id}`);

      // Verify state if provided
      if (state) {
        console.log('🔍 Verifying OAuth state...');
        const { data: tempToken, error: tempError } = await supabase
          .from('oauth_temp_tokens')
          .select('*')
          .eq('oauth_token', state)
          .eq('user_id', session.user.id)
          .eq('provider_type', 'polar')
          .maybeSingle();

        if (tempError || !tempToken) {
          console.warn('⚠️ State verification failed, but continuing...');
          console.warn('State error:', tempError);
        } else {
          console.log('✅ State verified successfully');
        }

        // Clean up temp token
        if (tempToken) {
          console.log('🧹 Cleaning up temporary token...');
          await supabase
            .from('oauth_temp_tokens')
            .delete()
            .eq('id', tempToken.id);
        }
      }

      // Exchange code for tokens via our edge function
      setMessage('Trocando código de autorização por tokens...');
      console.log('🔄 Calling polar-oauth edge function...');
      
      const functionPayload = {
        code,
        redirect_uri: `${window.location.origin}/polar-callback`,
        ...(state && { state })
      };
      console.log('📤 Function payload:', functionPayload);
      
      const functionStartTime = Date.now();
      const { data, error: exchangeError } = await supabase.functions.invoke('polar-oauth', {
        body: functionPayload
      });
      const functionDuration = Date.now() - functionStartTime;
      
      console.log(`📡 Edge function completed in ${functionDuration}ms`);

      console.log('📡 Edge function response received');
      console.log('📡 Exchange error:', exchangeError);
      console.log('📡 Response data:', data);

      if (exchangeError) {
        console.error('❌ Edge function error:', exchangeError);
        throw new Error(`Token exchange failed: ${exchangeError.message}`);
      }

      if (!data?.success) {
        console.error('❌ Token exchange failed:', data);
        throw new Error(data?.error || 'Unknown error during token exchange');
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Polar connection successful! Duration: ${duration}ms`);
      console.log('✅ X-User-ID:', data.x_user_id);
      
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
      const duration = Date.now() - startTime;
      console.error(`❌ Polar callback failed after ${duration}ms`);
      console.error('❌ Error details:', error);
      
      setStatus('error');
      
      let errorMessage = 'Erro desconhecido na conexão';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide more specific error messages
        if (error.message.includes('credentials')) {
          errorMessage = 'Erro de configuração da API. Contate o suporte.';
        } else if (error.message.includes('Token exchange failed')) {
          errorMessage = 'Falha na autenticação com a Polar. Tente novamente.';
        } else if (error.message.includes('User not authenticated')) {
          errorMessage = 'Sessão expirada. Faça login novamente.';
        }
      }
      
      setMessage(errorMessage);
      
      toast({
        title: "Erro na conexão",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleRetry = () => {
    navigate('/sync');
  };

  const handleShowDebug = async () => {
    await runFullDiagnostics();
    setShowDebugInfo(true);
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
            <div className="space-y-2">
              <Button onClick={handleRetry} className="w-full">
                Tentar Novamente
              </Button>
              <Button 
                onClick={handleShowDebug} 
                variant="outline" 
                className="w-full"
                size="sm"
              >
                <Bug className="h-4 w-4 mr-2" />
                Mostrar Diagnóstico
              </Button>
            </div>
          )}
          
          {showDebugInfo && debugInfo && (
            <div className="mt-4 p-4 bg-muted rounded-lg text-left">
              <h4 className="font-semibold mb-2">Informações de Diagnóstico:</h4>
              <div className="text-xs space-y-1">
                <p><strong>URL atual:</strong> {debugInfo.currentUrl}</p>
                <p><strong>Callback esperado:</strong> {debugInfo.expectedCallback}</p>
                <p><strong>Usuário autenticado:</strong> {debugInfo.userSession.authenticated ? 'Sim' : 'Não'}</p>
                <p><strong>Health check:</strong> {debugInfo.healthCheck.success ? '✅' : '❌'}</p>
                <p><strong>Config check:</strong> {debugInfo.configCheck.success ? '✅' : '❌'}</p>
                {Object.keys(debugInfo.urlParameters).length > 0 && (
                  <p><strong>Parâmetros URL:</strong> {JSON.stringify(debugInfo.urlParameters)}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}