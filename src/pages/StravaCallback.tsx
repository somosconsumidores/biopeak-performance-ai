import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStravaAuth } from '@/hooks/useStravaAuth';
import { useStravaSync } from '@/hooks/useStravaSync';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

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
        
        // Force refresh of Strava stats to update UI immediately
        console.log('[StravaCallback] Invalidating all Strava queries...');
        queryClient.invalidateQueries({ queryKey: ['strava-stats'] });
        queryClient.invalidateQueries({ queryKey: ['strava-activities'] });
        
        // Start automatic sync after successful authentication
        console.log('[StravaCallback] Starting automatic activity sync...');
        setMessage('Tenha paciência, estamos sincronizando suas atividades. Já já finalizamos! 😊');
        setSyncStartTime(Date.now());
        
        const syncSuccess = await syncActivities();
        if (syncSuccess) {
          setMessage('Atividades sincronizadas com sucesso!');
          // Refresh queries again after sync
          queryClient.invalidateQueries({ queryKey: ['strava-stats'] });
          queryClient.invalidateQueries({ queryKey: ['strava-activities'] });
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
                ✅ Todas as atividades foram sincronizadas!
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