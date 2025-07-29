import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStravaAuth } from '@/hooks/useStravaAuth';
import { useStravaSync } from '@/hooks/useStravaSync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function StravaCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useStravaAuth();
  const { syncActivities, isLoading: isSyncing } = useStravaSync();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processando autenticação...');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Prevent multiple simultaneous executions
    if (isProcessing) {
      console.log('[StravaCallback] Already processing, skipping...');
      return;
    }

    const processCallback = async () => {
      setIsProcessing(true);
      console.log('[StravaCallback] Starting callback processing...');
      
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const currentUrl = window.location.href;

      console.log('[StravaCallback] URL parameters:', { 
        code: code ? `${code.substring(0, 10)}...` : null, 
        state: state ? `${state.substring(0, 20)}...` : null, 
        error,
        currentUrl 
      });

      if (error) {
        console.error('[StravaCallback] OAuth error received:', error);
        setStatus('error');
        setMessage(`Erro na autorização: ${error}`);
        setTimeout(() => navigate('/sync'), 3000);
        return;
      }

      if (!code || !state) {
        console.error('[StravaCallback] Missing parameters:', { code: !!code, state: !!state });
        setStatus('error');
        setMessage('Parâmetros de autorização ausentes');
        setTimeout(() => navigate('/sync'), 3000);
        return;
      }

      try {
        console.log('[StravaCallback] Starting authentication with Strava...');
        setMessage('Autenticando com o Strava...');
        
        // Small delay to prevent visual flicker
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const authSuccess = await handleCallback(code, state);
        console.log('[StravaCallback] Authentication result:', authSuccess);
        
        if (!authSuccess) {
          console.error('[StravaCallback] Authentication failed');
          setStatus('error');
          setMessage('Falha na autenticação com o Strava');
          setTimeout(() => navigate('/sync'), 3000);
          return;
        }

        console.log('[StravaCallback] Authentication successful!');
        setStatus('success');
        setMessage('Strava conectado com sucesso!');
        
        // Start automatic sync after successful authentication
        console.log('[StravaCallback] Starting automatic activity sync...');
        setMessage('Sincronizando atividades...');
        
        const syncSuccess = await syncActivities();
        if (syncSuccess) {
          setMessage('Atividades sincronizadas com sucesso!');
        } else {
          setMessage('Strava conectado, mas houve erro na sincronização');
        }
        
        console.log('[StravaCallback] Redirecting to dashboard...');
        setTimeout(() => navigate('/dashboard'), 2000);
        
      } catch (error) {
        console.error('[StravaCallback] Callback processing error:', error);
        setStatus('error');
        setMessage('Erro inesperado durante o processamento');
        setTimeout(() => navigate('/sync'), 3000);
      } finally {
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [searchParams, handleCallback, navigate, isProcessing, syncActivities]);

  const getIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-8 h-8 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <XCircle className="w-8 h-8 text-destructive" />;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getIcon()}
          </div>
          <CardTitle>
            {status === 'processing' && 'Conectando ao Strava'}
            {status === 'success' && 'Sucesso!'}
            {status === 'error' && 'Erro na Conexão'}
          </CardTitle>
          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'processing' && (
            <p className="text-sm text-muted-foreground">
              {isSyncing ? 'Sincronizando suas atividades...' : 'Aguarde enquanto processamos sua autenticação...'}
            </p>
          )}
          {status === 'success' && (
            <p className="text-sm text-muted-foreground">
              Redirecionando para o dashboard...
            </p>
          )}
          {status === 'error' && (
            <p className="text-sm text-muted-foreground">
              Redirecionando de volta...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}