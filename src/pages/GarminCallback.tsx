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

      // Extract userId from state (format: userId:timestamp)
      const stateParts = urlParams.state.split(':');
      if (stateParts.length < 2) {
        console.error('❌ Invalid state format - expected userId:timestamp');
        setStatus('error');
        setErrorMessage('Formato de state inválido');
        return;
      }

      const userId = stateParts[0];
      console.log('🔍 Extracted userId from state:', userId);

      // Try to get PKCE data from localStorage first (web flow)
      let pkceData = getPKCEData();
      console.log('🔍 PKCE from localStorage:', pkceData ? 'found' : 'not found');
      
      // If not found in localStorage, try to fetch from Supabase (native flow)
      if (!pkceData) {
        console.log('🔍 Attempting to fetch PKCE from Supabase for user:', userId);
        
        try {
          const { data: pkceFromDb, error: pkceError } = await supabase
            .from('oauth_temp_tokens')
            .select('oauth_token, oauth_token_secret')
            .eq('user_id', userId)
            .eq('provider', 'garmin_pkce')
            .maybeSingle();
          
          if (pkceError) {
            console.error('❌ Error fetching PKCE from Supabase:', pkceError);
          } else if (pkceFromDb) {
            console.log('✅ PKCE found in Supabase');
            pkceData = {
              codeVerifier: pkceFromDb.oauth_token,
              state: pkceFromDb.oauth_token_secret
            };
            
            // Store in localStorage for reference
            storePKCEData(pkceData);
          } else {
            console.log('⚠️ No PKCE data found in Supabase');
          }
        } catch (e) {
          console.error('❌ Error in PKCE Supabase lookup:', e);
        }
      }
      
      if (!pkceData) {
        console.error('❌ No PKCE data found anywhere');
        setStatus('error');
        setErrorMessage('Dados de autenticação não encontrados. Tente conectar novamente.');
        return;
      }

      console.log('📞 Calling garmin-oauth Edge Function with userId from state...');
      
      try {
        // Call the edge function directly without JWT (public mode with userId)
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://grcwlmltlcltmwbhdpky.supabase.co'}/functions/v1/garmin-oauth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM',
          },
          body: JSON.stringify({
            code: urlParams.code,
            codeVerifier: pkceData.codeVerifier,
            redirectUri: GARMIN_REDIRECT_URI,
            userId: userId, // Pass userId from state for public callback
          }),
        });

        const result = await response.json();
        
        if (!response.ok) {
          console.error('❌ Edge function error:', result);
          throw new Error(result.error || 'Erro ao processar autorização');
        }

        console.log('✅ Garmin OAuth completed successfully');
        
        // Clean up PKCE data from Supabase
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

        // Clear localStorage
        localStorage.removeItem('garmin_pkce');
        localStorage.removeItem('garmin_native_auth_pending');

        setStatus('success');
        
        // Check if this is a native flow - use deep link to return to app
        const isNativeFlow = localStorage.getItem('garmin_native_auth_pending') === 'true';
        
        if (isNativeFlow) {
          console.log('📱 [GarminCallback] Native flow detected - using deep link');
          // Deep link will close Safari View Controller and return to app
          // Small delay to show success message
          setTimeout(() => {
            window.location.href = 'biopeak://garmin-success';
          }, 1500);
        } else {
          // Web flow - redirect to sync page
          console.log('🌐 [GarminCallback] Web flow - redirecting to /sync');
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
