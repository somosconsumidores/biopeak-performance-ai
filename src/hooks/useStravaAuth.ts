import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

interface StravaConfig {
  clientId: string;
  redirectUri: string;
}

export const useStravaAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleStravaConnect = async () => {
    setIsLoading(true);
    
    try {
      console.log('🚀 [StravaAuth] Initiating Strava connection...');
      console.log('🔍 [StravaAuth] User info:', { userId: user?.id, email: user?.email });
      
      // 1. Get Strava configuration
      console.log('🔵 [StravaAuth] Fetching Strava configuration...');
      const { data: configData, error: configError } = await supabase.functions.invoke('strava-config');
      
      console.log('🔍 [StravaAuth] Config response:', { 
        hasData: !!configData, 
        hasError: !!configError,
        clientId: configData?.clientId ? `${configData.clientId.substring(0, 4)}...` : 'none',
        redirectUri: configData?.redirectUri,
        error: configError
      });
      
      console.log('🚨 [DEBUG] Full config response for debugging:', configData);
      
      if (configError || !configData) {
        console.error('❌ [StravaAuth] Config error:', configError);
        toast({
          title: "Erro de configuração",
          description: "Não foi possível obter a configuração do Strava",
          variant: "destructive",
        });
        return;
      }

      const config: StravaConfig = configData;
      
      // 2. Build authorization URL with enhanced security
      const scope = 'read,activity:read_all';
      const responseType = 'code';
      const state = crypto.randomUUID();
      const timestamp = Date.now().toString();
      const stateWithTimestamp = `${state}:${timestamp}`;
      
      const authUrl = new URL('https://www.strava.com/oauth/authorize');
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('response_type', responseType);
      authUrl.searchParams.set('redirect_uri', config.redirectUri);
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('state', stateWithTimestamp);
      authUrl.searchParams.set('approval_prompt', 'force');
      
      console.log('🔵 [StravaAuth] Generated OAuth parameters:', {
        state: stateWithTimestamp,
        scope: scope,
        clientId: config.clientId.substring(0, 4) + '...',
        redirectUri: config.redirectUri,
        timestamp: timestamp
      });
      console.log('🚀 [StravaAuth] Authorization URL:', authUrl.toString());
      
      // Log user state for debugging (não bloquear fluxo - validação ocorre no backend)
      console.log('🔍 [StravaAuth] User state:', { 
        hasUser: !!user, 
        userId: user?.id 
      });

      console.log('🔵 [StravaAuth] Storing OAuth state in multiple locations...');

      try {
        // 1. Store in multiple places for redundancy
        localStorage.setItem('strava_oauth_state', stateWithTimestamp);
        localStorage.setItem('strava_oauth_redirect_uri', config.redirectUri);
        
        sessionStorage.setItem('strava_oauth_state', stateWithTimestamp);
        sessionStorage.setItem('strava_oauth_redirect_uri', config.redirectUri);
        
        // 2. Store in database for cross-domain/cross-session persistence
        const { error: dbError } = await supabase
          .from('oauth_states')
          .upsert({
            user_id: user.id,
            provider: 'strava',
            state_value: stateWithTimestamp,
            redirect_uri: config.redirectUri
          });

        if (dbError) {
          console.warn('⚠️ [StravaAuth] Database storage failed:', dbError);
          // Continue anyway, we have localStorage/sessionStorage
        } else {
          console.log('✅ [StravaAuth] State stored in database');
        }
        
        // Verify storage immediately
        const storedState = localStorage.getItem('strava_oauth_state');
        const sessionState = sessionStorage.getItem('strava_oauth_state');
        
        console.log('✅ [StravaAuth] State storage verification:', {
          generated: stateWithTimestamp,
          localStorage: storedState,
          sessionStorage: sessionState,
          localStorageMatch: storedState === stateWithTimestamp,
          sessionStorageMatch: sessionState === stateWithTimestamp
        });
        
        if (!storedState && !sessionState) {
          console.error('❌ [StravaAuth] Failed to store OAuth state in any storage');
          throw new Error('Failed to store OAuth state in any storage');
        }
      } catch (storageError) {
        console.error('❌ [StravaAuth] Storage error:', storageError);
        toast({
          title: "Erro de armazenamento",
          description: "Não foi possível salvar o estado OAuth. Verifique se o armazenamento está habilitado.",
          variant: "destructive",
        });
        return;
      }
      
      // 3. Redirect to Strava authorization
      console.log('🚀 [StravaAuth] Redirecting to Strava authorization...');
      window.location.href = authUrl.toString();
      
    } catch (error) {
      console.error('❌ [StravaAuth] Connect error:', error);
      toast({
        title: "Erro na conexão",
        description: "Erro inesperado ao conectar com o Strava",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallback = async (code: string, state: string): Promise<boolean> => {
    // Prevent concurrent processing
    if (isProcessing) {
      console.warn('⚠️ [StravaAuth] Already processing callback, skipping...');
      return false;
    }

    setIsProcessing(true);

    try {
      console.log('🚀 [StravaAuth] Callback received:', {
        hasCode: !!code,
        codeLength: code?.length,
        state: state?.substring(0, 20) + '...',
        url: window.location.href
      });

      // Check if we're already processing this code to prevent concurrent processing
      const processedCodeKey = `strava_processed_code_${code}`;
      const existingProcess = localStorage.getItem(processedCodeKey);
      
      if (existingProcess) {
        const processTime = parseInt(existingProcess);
        const timeSinceProcess = Date.now() - processTime;
        
        // Only block if it was processed within the last minute (60 seconds)
        if (timeSinceProcess < 60 * 1000) {
          console.warn('⚠️ [StravaAuth] Code recently processed, skipping...', {
            timeSinceProcess,
            processTime: new Date(processTime).toISOString()
          });
          return false;
        } else {
          // Clear old processed flag if more than 1 minute old
          localStorage.removeItem(processedCodeKey);
        }
      }

      // Mark code as being processed (will be cleared after processing)
      localStorage.setItem(processedCodeKey, Date.now().toString());
      
      // Para fluxo nativo, usar o user_id salvo no localStorage
      const isNativeFlow = localStorage.getItem('strava_connect_flow') === 'native';
      const savedUserId = localStorage.getItem('strava_connect_user_id');
      
      const effectiveUserId = isNativeFlow && savedUserId ? savedUserId : user?.id;
      
      if (!effectiveUserId) {
        console.error('❌ [StravaAuth] User not authenticated in callback', {
          isNativeFlow,
          hasSavedUserId: !!savedUserId,
          hasCurrentUser: !!user?.id
        });
        return false;
      }
      
      console.log('✅ [StravaAuth] Using user ID:', {
        isNativeFlow,
        userId: effectiveUserId.substring(0, 8) + '...',
        source: isNativeFlow && savedUserId ? 'localStorage' : 'current session'
      });
      
      // Hybrid validation: try multiple storage sources
      let storedState: string | null = null;
      let storedRedirectUri: string | null = null;
      let validationSource = '';

      try {
        // 1. Try localStorage first
        storedState = localStorage.getItem('strava_oauth_state');
        storedRedirectUri = localStorage.getItem('strava_oauth_redirect_uri');
        
        console.log('🔍 [StravaAuth] localStorage check:', {
          hasState: !!storedState,
          hasRedirectUri: !!storedRedirectUri,
          state: storedState,
          redirectUri: storedRedirectUri
        });
        
        if (storedState && storedRedirectUri) {
          validationSource = 'localStorage';
          console.log('✅ [StravaAuth] Using localStorage for validation');
        } else {
          // 2. Try sessionStorage
          storedState = sessionStorage.getItem('strava_oauth_state');
          storedRedirectUri = sessionStorage.getItem('strava_oauth_redirect_uri');
          
          console.log('🔍 [StravaAuth] sessionStorage check:', {
            hasState: !!storedState,
            hasRedirectUri: !!storedRedirectUri,
            state: storedState,
            redirectUri: storedRedirectUri
          });
          
          if (storedState && storedRedirectUri) {
            validationSource = 'sessionStorage';
            console.log('✅ [StravaAuth] Using sessionStorage for validation');
          } else {
            // 3. Try database as fallback
            console.log('🔍 [StravaAuth] Checking database for state...');
            const { data: dbState, error: dbError } = await supabase
              .from('oauth_states')
              .select('state_value, redirect_uri')
              .eq('user_id', effectiveUserId)
              .eq('provider', 'strava')
              .gte('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            console.log('🔍 [StravaAuth] Database state check:', {
              hasData: !!dbState,
              error: dbError,
              stateValue: dbState?.state_value,
              redirectUri: dbState?.redirect_uri
            });
            
            if (dbState) {
              storedState = dbState.state_value;
              storedRedirectUri = dbState.redirect_uri;
              validationSource = 'database';
              console.log('✅ [StravaAuth] Using database for validation');
            }
          }
        }
        
        console.log('🔍 [StravaAuth] Final validation details:', {
          source: validationSource,
          hasStoredState: !!storedState,
          hasStoredRedirectUri: !!storedRedirectUri,
          storedState: storedState,
          storedRedirectUri: storedRedirectUri,
          receivedState: state
        });
        
      } catch (storageError) {
        console.error('❌ [StravaAuth] Storage access error:', storageError);
      }
      
      if (!storedState || !storedRedirectUri) {
        console.error('❌ [StravaAuth] No stored state found in any storage!');
        
        // Cleanup any partial states
        try {
          await supabase
            .from('oauth_states')
            .delete()
            .eq('user_id', effectiveUserId)
            .eq('provider', 'strava');
        } catch (cleanupError) {
          console.warn('⚠️ [StravaAuth] Cleanup error:', cleanupError);
        }
        
        toast({
          title: "Erro de segurança",
          description: "Estado OAuth não encontrado. Tente conectar novamente.",
          variant: "destructive",
        });
        return false;
      }
      
      // Parse state with timestamp validation
      const [storedStateValue, storedTimestamp] = storedState.split(':');
      const [receivedStateValue, receivedTimestamp] = state.split(':');
      
      console.log('🔍 [StravaAuth] State validation details:', {
        storedStateValue,
        storedTimestamp,
        receivedStateValue,
        receivedTimestamp,
        statesMatch: storedStateValue === receivedStateValue,
        timestampsMatch: storedTimestamp === receivedTimestamp
      });
      
      if (storedStateValue !== receivedStateValue || storedTimestamp !== receivedTimestamp) {
        console.error('❌ [StravaAuth] State validation failed!');
        toast({
          title: "Erro de segurança",
          description: "Estado OAuth inválido",
          variant: "destructive",
        });
        return false;
      }

      // Check timestamp (10 minutes expiry)
      const timestamp = parseInt(storedTimestamp);
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;
      
      if (now - timestamp > tenMinutes) {
        console.error('❌ [StravaAuth] OAuth state expired!', {
          timestamp,
          now,
          difference: now - timestamp,
          maxAllowed: tenMinutes
        });
        toast({
          title: "Erro de segurança",
          description: "Estado OAuth expirado",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ [StravaAuth] State validation passed');
      
      // Clear stored states from all sources
      console.log('🧹 [StravaAuth] Cleaning up OAuth states...');
      localStorage.removeItem('strava_oauth_state');
      localStorage.removeItem('strava_oauth_redirect_uri');
      sessionStorage.removeItem('strava_oauth_state');
      sessionStorage.removeItem('strava_oauth_redirect_uri');
      
      // Cleanup database state
      try {
        await supabase
          .from('oauth_states')
          .delete()
          .eq('user_id', effectiveUserId)
          .eq('provider', 'strava')
          .eq('state_value', storedState);
      } catch (cleanupError) {
        console.warn('⚠️ [StravaAuth] Database cleanup error:', cleanupError);
      }

      console.log('🔵 [StravaAuth] Exchanging code for tokens...', {
        redirectUri: storedRedirectUri,
        codeLength: code.length
      });
      
      // Exchange code for tokens
      const { data: authData, error: authError } = await supabase.functions.invoke('strava-auth', {
        body: {
          code,
          redirect_uri: storedRedirectUri
        }
      });

      console.log('🔍 [StravaAuth] Token exchange response:', {
        hasData: !!authData,
        hasError: !!authError,
        success: authData?.success,
        athleteId: authData?.athlete?.id,
        error: authError
      });
      
      if (authError || !authData?.success) {
        console.error('❌ [StravaAuth] Token exchange error:', authError);
        
        // Clean up processed code flag on error
        localStorage.removeItem(processedCodeKey);
        
        // Check for specific error types
        let errorMessage = "Não foi possível autenticar com o Strava";
        if (authError?.message?.includes('invalid')) {
          errorMessage = "Código de autorização inválido ou expirado";
        } else if (authError?.message?.includes('expired')) {
          errorMessage = "Autorização expirada. Tente novamente.";
        }
        
        toast({
          title: "Falha na autenticação",
          description: errorMessage,
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ [StravaAuth] Authentication successful!', {
        athleteId: authData.athlete?.id,
        athleteName: authData.athlete?.firstname
      });

      // Clear the processed code flag on successful completion
      localStorage.removeItem(processedCodeKey);

      // Invalidate Strava stats query to refresh the UI
      console.log('🔄 [StravaAuth] Invalidating strava-stats query...');
      queryClient.invalidateQueries({ queryKey: ['strava-stats'] });
      
      toast({
        title: "Conectado com sucesso!",
        description: `Bem-vindo, ${authData.athlete?.firstname || 'atleta'}!`,
      });
      
      return true;

    } catch (error) {
      console.error('❌ [StravaAuth] Callback error:', error);
      toast({
        title: "Erro no callback",
        description: "Erro inesperado durante a autenticação",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    handleStravaConnect,
    handleCallback,
    isLoading,
  };
};