import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseCallbackParams, getPKCEData, storePKCEData } from '@/lib/garmin-oauth';
import { supabase } from '@/integrations/supabase/client';

// Hardcoded redirect URI for production
const GARMIN_REDIRECT_URI = 'https://biopeak-ai.com/garmin-callback';

export function GarminCallback() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Safety redirect: ensure callback is processed on production domain
  useEffect(() => {
    const urlParams = parseCallbackParams(window.location.href);
    const host = window.location.hostname;
    const isProdHost = host === 'biopeak-ai.com' || host === 'www.biopeak-ai.com';
    
    if (urlParams.code && urlParams.state && !isProdHost) {
      const target = `https://biopeak-ai.com/garmin-callback?code=${urlParams.code}&state=${urlParams.state}`;
      console.log('[GarminCallback] Redirecting to production:', target);
      window.location.href = target;
      return;
    }
  }, []);

  useEffect(() => {
    const processCallback = async () => {
      if (isProcessing) return;
      setIsProcessing(true);
      
      console.log('🔄 GarminCallback component mounted (public route)');
      console.log('🔍 Current URL:', window.location.href);
      
      // Parse the OAuth callback parameters
      const urlParams = parseCallbackParams(window.location.href);
      console.log('🔍 Parsed callback params:', urlParams);
      
      if (urlParams.error) {
        console.error('❌ OAuth error received:', urlParams.error);
        setStatus('error');
        setErrorMessage('Erro na autorização do Garmin');
        return;
      }
      
      if (!urlParams.code || !urlParams.state) {
        console.log('❌ Invalid callback - no code or state');
        setStatus('error');
        setErrorMessage('Parâmetros de callback inválidos');
        return;
      }

      // Detect flow type by state format
      // Native flow: state = "userId:timestamp" (UUID is 36 chars)
      // Web/PWA flow: state = random PKCE string
      const stateParts = urlParams.state.split(':');
      const isNativeFlow = stateParts.length >= 2 && stateParts[0].length === 36;
      
      let userId: string | null = null;
      let codeVerifier: string | null = null;

      if (isNativeFlow) {
        // === NATIVE FLOW ===
        // State format: userId:timestamp
        userId = stateParts[0];
        console.log('📱 Native flow detected - userId from state:', userId);
        // Edge function will fetch PKCE from Supabase using service role
        
      } else {
        // === WEB/PWA FLOW ===
        console.log('🌐 Web/PWA flow detected - checking authenticated user');
        
        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('❌ User not authenticated');
          setStatus('error');
          setErrorMessage('Usuário não autenticado. Faça login e tente novamente.');
          return;
        }
        userId = user.id;
        console.log('🔍 Authenticated userId:', userId);
        
        // Verify PKCE from localStorage
        const pkceData = getPKCEData();
        if (!pkceData) {
          console.error('❌ PKCE data not found in localStorage');
          setStatus('error');
          setErrorMessage('Dados de segurança não encontrados. Tente novamente.');
          return;
        }
        
        if (pkceData.state !== urlParams.state) {
          console.error('❌ State mismatch - possible CSRF attack');
          console.error('Expected:', pkceData.state, 'Got:', urlParams.state);
          setStatus('error');
          setErrorMessage('Parâmetros de segurança inválidos. Tente novamente.');
          return;
        }
        
        codeVerifier = pkceData.codeVerifier;
        console.log('🔐 PKCE verified from localStorage');
      }

      console.log('📞 Calling garmin-oauth Edge Function...');
      
      try {
        // Call the edge function directly without JWT (public mode with userId)
        const response = await fetch(`https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/garmin-oauth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM',
          },
          body: JSON.stringify({
            code: urlParams.code,
            codeVerifier: codeVerifier, // Web: from localStorage, Native: null (edge fetches from DB)
            redirectUri: GARMIN_REDIRECT_URI,
            userId: userId,
          }),
        });

        const result = await response.json();
        
        if (!response.ok) {
          console.error('❌ Edge function error:', result);
          throw new Error(result.error || 'Erro ao processar autorização');
        }

        console.log('✅ Garmin OAuth completed successfully');
        
        // Clean up PKCE data from Supabase (if native flow stored it there)
        if (isNativeFlow) {
          try {
            await supabase
              .from('oauth_temp_tokens')
              .delete()
              .eq('user_id', userId)
              .eq('provider', 'garmin_pkce');
            console.log('🧹 PKCE data cleaned from Supabase');
          } catch (e) {
            console.log('⚠️ Could not clean PKCE data:', e);
          }
        }

        // Clear localStorage
        localStorage.removeItem('garmin_pkce');
        localStorage.removeItem('garmin_native_auth_pending');

        setStatus('success');
        
        if (isNativeFlow) {
          console.log('📱 [GarminCallback] Native flow - using deep link');
          // Deep link will close Safari View Controller and return to app
          setTimeout(() => {
            window.location.href = 'biopeak://garmin-success';
          }, 1500);
        } else {
          // Web/PWA flow - redirect to sync page
          console.log('🌐 [GarminCallback] Web/PWA flow - redirecting to /sync');
          setTimeout(() => {
            navigate('/sync');
          }, 2000);
        }

      } catch (error) {
        console.error('❌ Error processing OAuth callback:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido');
      }
    };
    
    processCallback();
  }, [navigate, isProcessing]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Processando conexão Garmin...
            </h2>
            <p className="text-muted-foreground">
              Por favor, aguarde enquanto finalizamos a conexão com sua conta Garmin.
            </p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Garmin conectado com sucesso!
            </h2>
            <p className="text-muted-foreground mb-4">
              Suas atividades serão sincronizadas automaticamente.
            </p>
            <p className="text-sm text-muted-foreground">
              Você pode voltar ao app BioPeak agora.
            </p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Erro na conexão
            </h2>
            <p className="text-muted-foreground mb-4">
              {errorMessage || 'Não foi possível conectar ao Garmin.'}
            </p>
            <button 
              onClick={() => navigate('/sync')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Tentar novamente
            </button>
          </>
        )}
      </div>
    </div>
  );
}
