import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { useStravaSync } from '@/hooks/useStravaSync';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getProductionRedirectUrl } from '@/lib/utils';

export default function StravaCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { syncActivities, syncActivitiesOptimized, isLoading: isSyncing } = useStravaSync();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processando autenticação...');
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncStartTime, setSyncStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedProgress, setEstimatedProgress] = useState(0);
  const processedRef = useRef(false); // Ref to track if we've already processed

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
      window.location.href = target; // Use href instead of replace to avoid browser issues
      return;
    }
  }, [searchParams]);

  useEffect(() => {
    // Prevent multiple simultaneous executions using ref
    if (isProcessing || processedRef.current) {
      console.log('[StravaCallback] Already processing or processed, skipping...', {
        isProcessing,
        processedRef: processedRef.current
      });
      return;
    }

    const processCallback = async () => {
      // Double-check to prevent race conditions
      if (processedRef.current) {
        console.log('[StravaCallback] Already processed in race condition check');
        return;
      }

      processedRef.current = true;
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

      // Detectar fluxo nativo para logging
      const isNativeFlow = localStorage.getItem('strava_connect_flow') === 'native';
      const isNativePlatform = Capacitor.isNativePlatform();
      
      console.log('📱 [StravaCallback] Platform detection:', { 
        isNativeFlow, 
        isNativePlatform,
        willProcessOAuthFirst: true
      });

      if (error) {
        console.error('[StravaCallback] OAuth error received:', error);
        setStatus('error');
        setMessage(`Erro na autorização: ${error}`);
        setTimeout(() => {
          window.location.href = getProductionRedirectUrl('/sync');
        }, 3000);
        return;
      }

      if (!code || !state) {
        console.error('[StravaCallback] Missing parameters:', { code: !!code, state: !!state });
        setStatus('error');
        setMessage('Parâmetros de autorização ausentes');
        setTimeout(() => {
          window.location.href = getProductionRedirectUrl('/sync');
        }, 3000);
        return;
      }

      try {
        console.log('[StravaCallback] Starting authentication with Strava...');
        setMessage('Autenticando com o Strava...');
        
        // Extrair user_id do state (formato: userId:timestamp)
        const [userId, timestamp] = state.split(':');
        
        if (!userId || !timestamp) {
          console.error('[StravaCallback] Invalid state format:', state);
          setStatus('error');
          setMessage('Estado OAuth inválido');
          setTimeout(() => {
            window.location.href = getProductionRedirectUrl('/sync');
          }, 3000);
          return;
        }
        
        console.log('[StravaCallback] State validated:', { userId: userId.substring(0, 8) + '...', timestamp });
        
        // Chamar strava-auth DIRETAMENTE (sem autenticação JWT)
        console.log('[StravaCallback] Calling strava-auth edge function...');
        const response = await fetch(
          'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/strava-auth',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state }),
          }
        );
        
        console.log('[StravaCallback] strava-auth response status:', response.status);
        
        if (!response.ok) {
          const error = await response.json();
          console.error('[StravaCallback] Auth failed:', error);
          setStatus('error');
          setMessage('Falha na autenticação com o Strava');
          setTimeout(() => {
            window.location.href = getProductionRedirectUrl('/sync');
          }, 3000);
          return;
        }

        console.log('[StravaCallback] Authentication successful!');
        setStatus('success');
        setMessage('Strava conectado com sucesso!');
        
        // Detectar fluxo nativo
        const isNativeFlow = localStorage.getItem('strava_connect_flow') === 'native';
        const isNativePlatform = Capacitor.isNativePlatform();
        
        console.log('[StravaCallback] Flow detection:', { isNativeFlow, isNativePlatform });
        
        // Se for fluxo nativo, enviar deep link (iOS fecha Safari automaticamente)
        if (isNativeFlow || isNativePlatform) {
          console.log('📱 [StravaCallback] Native flow - Sending deep link');
          window.location.href = 'biopeak://strava-success';
          return;
        }
        
        // Fluxo WEB normal continua aqui
        // Clear URL params immediately after successful auth to prevent re-processing
        console.log('[StravaCallback] Clearing URL parameters to prevent re-processing...');
        window.history.replaceState({}, '', '/strava-callback');
        
        // Force refresh of Strava stats to update UI immediately
        console.log('[StravaCallback] Invalidating all Strava queries...');
        queryClient.invalidateQueries({ queryKey: ['strava-stats'] });
        queryClient.invalidateQueries({ queryKey: ['strava-activities'] });
        
        // Fluxo WEB normal: sincronizar atividades
        console.log('[StravaCallback] WEB flow - starting optimized activity sync...');
        setMessage('Tenha paciência, estamos sincronizando suas atividades. Já já finalizamos! 😊');
        setSyncStartTime(Date.now());
        
        // Use optimized sync for faster processing
        const syncSuccess = await syncActivitiesOptimized();
        
        if (syncSuccess) {
          setMessage('Atividades sincronizadas com sucesso!');
          // Refresh queries again after sync
          queryClient.invalidateQueries({ queryKey: ['strava-stats'] });
          queryClient.invalidateQueries({ queryKey: ['strava-activities'] });
        } else {
          setMessage('Strava conectado, mas houve erro na sincronização');
        }
        
        // Fluxo WEB: redirecionar para dashboard
        console.log('[StravaCallback] Redirecting to dashboard...');
        setTimeout(() => {
          window.location.href = getProductionRedirectUrl('/dashboard');
        }, 2000);
        
      } catch (error) {
        console.error('[StravaCallback] Callback processing error:', error);
        setStatus('error');
        setMessage('Erro inesperado durante o processamento');
        setTimeout(() => {
          window.location.href = getProductionRedirectUrl('/sync');
        }, 3000);
      } finally {
        setIsProcessing(false);
      }
    };

    // Only process if we have the required parameters
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (code && state) {
      // Add a small debounce to prevent rapid re-execution
      const timeoutId = setTimeout(() => {
        processCallback();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    } else if (!processedRef.current) {
      // If no params and not processed, redirect to sync page
      console.log('[StravaCallback] No OAuth parameters found, redirecting to sync...');
      window.location.href = getProductionRedirectUrl('/sync');
    }
  }, [searchParams, queryClient]); // Removed dependencies that could cause loops

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
                  💡 <strong>Dica:</strong> Sincronização otimizada - importando suas atividades mais recentes primeiro!
                </p>
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Aguarde enquanto processamos sua autenticação...
              </p>
            </div>
          )}
          
          {status === 'success' && !isSyncing && (
            <div className="space-y-2">
              {localStorage.getItem('strava_connect_flow') === 'native' ? (
                <>
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-lg font-semibold text-green-800 dark:text-green-200 text-center">
                      ✅ Conta Strava conectada com sucesso!
                    </p>
                  </div>
                  <div className="text-center text-muted-foreground">
                    <p className="text-sm">Você pode voltar ao app BioPeak agora</p>
                    <p className="text-xs mt-2">Redirecionando automaticamente...</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-green-600 font-medium">
                    ✅ Todas as atividades foram sincronizadas!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Redirecionando para o dashboard...
                  </p>
                </>
              )}
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