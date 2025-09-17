import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStravaAuth } from '@/hooks/useStravaAuth';
import { useStravaSync } from '@/hooks/useStravaSync';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getProductionRedirectUrl } from '@/lib/utils';

export default function StravaCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useStravaAuth();
  const { syncActivities, isLoading: isSyncing } = useStravaSync();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processando autenticação...');
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncStartTime, setSyncStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedProgress, setEstimatedProgress] = useState(0);

  // Timer effect for sync progress
  useEffect(() => {
    if (!syncStartTime || !isSyncing) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - syncStartTime) / 1000);
      setElapsedTime(elapsed);
      
      // Simulate progress - faster at start, slower towards end
      // Estimated 2-3 minutes for large syncs
      const maxTime = 180; // 3 minutes
      const rawProgress = Math.min((elapsed / maxTime) * 100, 95);
      // Use exponential curve to slow down progress towards the end
      const curvedProgress = 100 * (1 - Math.exp(-3 * (elapsed / maxTime)));
      setEstimatedProgress(Math.min(curvedProgress, 95));
    }, 1000);

    return () => clearInterval(interval);
  }, [syncStartTime, isSyncing]);

  // Safety redirect: ensure callback is processed on production domain
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const host = window.location.hostname;
    const isProdHost = host === 'biopeak-ai.com' || host === 'www.biopeak-ai.com';
    if (code && state && !isProdHost) {
      const target = `https://biopeak-ai.com/strava-callback${window.location.search}`;
      console.log('[StravaCallback] Redirecting callback to production domain:', target);
      window.location.replace(target);
    }
  }, [searchParams]);

  const processCallbackDebounced = async () => {
    if (isProcessing) return;
    
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
      // Clear URL params before redirect
      window.history.replaceState({}, '', '/strava-callback');
      setTimeout(() => window.location.replace(getProductionRedirectUrl('/sync')), 3000);
      setIsProcessing(false);
      return;
    }

    if (!code || !state) {
      console.error('[StravaCallback] Missing parameters:', { code: !!code, state: !!state });
      setStatus('error');
      setMessage('Parâmetros de autorização ausentes');
      // Clear URL params before redirect
      window.history.replaceState({}, '', '/strava-callback');
      setTimeout(() => window.location.replace(getProductionRedirectUrl('/sync')), 3000);
      setIsProcessing(false);
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
        // Clear URL params before redirect
        window.history.replaceState({}, '', '/strava-callback');
        setTimeout(() => window.location.replace(getProductionRedirectUrl('/sync')), 3000);
        return;
      }

      console.log('[StravaCallback] Authentication successful!');
      setStatus('success');
      setMessage('Strava conectado com sucesso!');
      
      // Clear URL params immediately after successful auth to prevent re-processing
      console.log('[StravaCallback] Clearing URL parameters to prevent re-processing...');
      window.history.replaceState({}, '', '/strava-callback');
      
      // Force refresh of Strava stats to update UI immediately
      console.log('[StravaCallback] Invalidating all Strava queries...');
      queryClient.invalidateQueries({ queryKey: ['strava-stats'] });
      queryClient.invalidateQueries({ queryKey: ['strava-activities'] });
      
      // Start background sync after successful authentication
      console.log('[StravaCallback] Starting background activity sync...');
      setMessage('Strava conectado! Suas atividades serão sincronizadas em segundo plano.');
      
      // Redirect immediately to dashboard, sync will happen in background
      console.log('[StravaCallback] Redirecting to dashboard...');
      setTimeout(() => {
        window.location.replace(getProductionRedirectUrl('/dashboard'));
        
        // Start sync in background after redirect
        setTimeout(() => {
          console.log('[StravaCallback] Starting background sync...');
          syncActivities().then((syncSuccess) => {
            if (syncSuccess) {
              console.log('[StravaCallback] Background sync completed successfully');
              queryClient.invalidateQueries({ queryKey: ['strava-stats'] });
              queryClient.invalidateQueries({ queryKey: ['strava-activities'] });
            }
          });
        }, 1000);
      }, 1500);
      
    } catch (error) {
      console.error('[StravaCallback] Callback processing error:', error);
      setStatus('error');
      setMessage('Erro inesperado durante o processamento');
      // Clear URL params before redirect
      window.history.replaceState({}, '', '/strava-callback');
      setTimeout(() => window.location.replace(getProductionRedirectUrl('/sync')), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Add debounce to prevent multiple rapid executions
  useEffect(() => {
    // Prevent multiple simultaneous executions
    if (isProcessing) {
      console.log('[StravaCallback] Already processing, skipping...');
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (code && state) {
      // Debounce to prevent rapid multiple calls
      const timeoutId = setTimeout(() => {
        processCallbackDebounced();
      }, 300);

      return () => clearTimeout(timeoutId);
    } else if (!isProcessing) {
      // If no params and not processing, redirect to sync page
      console.log('[StravaCallback] No OAuth parameters found, redirecting to sync...');
      window.location.replace(getProductionRedirectUrl('/sync'));
    }
  }, [searchParams, isProcessing]);

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
        <CardContent className="text-center space-y-4">
          {status === 'processing' && isSyncing && syncStartTime && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Tempo decorrido: {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
                </div>
                <Progress value={estimatedProgress} className="w-full" />
                <p className="text-xs text-muted-foreground">
                  {estimatedProgress < 30 && "Iniciando sincronização..."}
                  {estimatedProgress >= 30 && estimatedProgress < 60 && "Processando suas atividades..."}
                  {estimatedProgress >= 60 && estimatedProgress < 90 && "Quase terminando..."}
                  {estimatedProgress >= 90 && "Finalizando..."}
                </p>
              </div>
              <div className="bg-muted/20 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Dica:</strong> Quanto mais atividades você tiver, mais tempo levará. 
                  Estamos importando todo seu histórico do Strava!
                </p>
              </div>
            </div>
          )}
          
          {status === 'processing' && !isSyncing && (
            <p className="text-sm text-muted-foreground">
              Aguarde enquanto processamos sua autenticação...
            </p>
          )}
          
          {status === 'success' && !isSyncing && (
            <div className="space-y-2">
              <p className="text-sm text-green-600 font-medium">
                ✅ Conexão estabelecida com sucesso!
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecionando para o dashboard...
              </p>
            </div>
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