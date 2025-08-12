
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  generatePKCE, 
  generateState, 
  buildGarminAuthURL, 
  parseCallbackParams,
  clearStoredTokens,
  storePKCEData,
  getPKCEData,
  type GarminTokens
} from '@/lib/garmin-oauth';
import { useToast } from '@/hooks/use-toast';

const REDIRECT_URI = `${window.location.origin}/garmin-callback`;

export const useGarminAuth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [tokens, setTokens] = useState<GarminTokens | null>(null);
  const { toast } = useToast();

  // Check for existing tokens on mount
  useEffect(() => {
    const checkExistingTokens = async () => {
      try {
        console.log('[useGarminAuth] Checking for existing tokens...');
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[useGarminAuth] Current user:', user ? `ID: ${user.id}` : 'No user');
        if (!user) {
          console.log('[useGarminAuth] No authenticated user');
          return;
        }

        // Minimal connection check without exposing tokens
        const { data: dbTokens, error } = await supabase
          .from('garmin_tokens')
          .select('is_active, expires_at')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('[useGarminAuth] Error checking database token status:', error);
          return;
        }

        if (dbTokens) {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      } catch (error) {
        console.error('[useGarminAuth] Error checking tokens:', error);
      }
    };

    checkExistingTokens();
  }, []);

  const startOAuthFlow = useCallback(async () => {
    try {
      setIsConnecting(true);
      console.log('[useGarminAuth] Starting OAuth flow...');

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[useGarminAuth] OAuth flow - Current user:', user ? `ID: ${user.id}` : 'No user');
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get client ID from edge function
      const { data: clientData, error: clientError } = await supabase.functions.invoke('garmin-oauth', {
        method: 'GET'
      });

      if (clientError) {
        console.error('[useGarminAuth] Error getting client ID:', clientError);
        throw new Error('Failed to get client configuration');
      }

      const clientId = clientData.client_id;
      console.log('[useGarminAuth] Got client ID:', clientId);

      // Generate PKCE parameters
      const { codeVerifier, codeChallenge } = await generatePKCE();
      const state = generateState();

      // Store PKCE data
      storePKCEData({ codeVerifier, state });
      console.log('[useGarminAuth] Generated and stored PKCE data');

      // Build authorization URL
      const authUrl = buildGarminAuthURL(clientId, REDIRECT_URI, codeChallenge, state);
      console.log('[useGarminAuth] Redirecting to:', authUrl);

      // Redirect to Garmin
      window.location.href = authUrl;
    } catch (error) {
      console.error('[useGarminAuth] Error starting OAuth flow:', error);
      toast({
        title: "Erro na conexão",
        description: error instanceof Error ? error.message : "Erro desconhecido ao iniciar conexão.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  }, [toast]);

  const triggerAutoBackfill = useCallback(async () => {
    try {
      console.log('[useGarminAuth] Starting automatic 30-day backfill...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[useGarminAuth] No session for backfill');
        return;
      }

      // Use 30 days for activities (as recommended by Garmin to avoid pull notifications)
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (30 * 24 * 60 * 60); // 30 days ago
      
      // Calculate 15 days ago for activity details
      const detailsEndTime = endTime;
      const detailsStartTime = endTime - (15 * 24 * 60 * 60); // 15 days ago

      const backfillRequest = {
        timeRange: 'custom' as const,
        start: startTime,
        end: endTime,
        activityDetailsTimeRange: {
          start: detailsStartTime,
          end: detailsEndTime
        }
      };

      console.log('[useGarminAuth] Triggering async backfill (no pull notifications):', {
        activitiesRange: {
          startDate: new Date(startTime * 1000).toISOString(),
          endDate: new Date(endTime * 1000).toISOString(),
          days: 30
        },
        detailsRange: {
          startDate: new Date(detailsStartTime * 1000).toISOString(),
          endDate: new Date(detailsEndTime * 1000).toISOString(),
          days: 15
        }
      });

      const { data, error } = await supabase.functions.invoke('backfill-activities', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: backfillRequest
      });

      if (error) {
        console.error('[useGarminAuth] Auto backfill error:', error);
        return;
      }

      if (data.error) {
        console.error('[useGarminAuth] Auto backfill API error:', data);
        return;
      }

      console.log('[useGarminAuth] Auto backfill completed successfully:', data);
      
      // Show a subtle notification about the background process
      toast({
        title: "Importação iniciada",
        description: "Suas atividades dos últimos 30 dias e detalhes dos últimos 15 dias estão sendo importados via webhook.",
        variant: "default",
      });

    } catch (error) {
      console.error('[useGarminAuth] Auto backfill unexpected error:', error);
    }
  }, [toast]);

  const handleOAuthCallback = useCallback(async (code: string, state: string) => {
    try {
      console.log('[useGarminAuth] Handling OAuth callback...');
      
      // Get current user and session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('User not authenticated');
      }

      // Verify state parameter
      const pkceData = getPKCEData();
      if (!pkceData || pkceData.state !== state) {
        console.error('[useGarminAuth] State verification failed:', {
          storedState: pkceData?.state,
          receivedState: state
        });
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      console.log('[useGarminAuth] State verified, exchanging code for tokens...');

      // Check if this is a first-time connection by looking at initial_sync_completed
      const { data: existingTokens } = await supabase
        .from('garmin_tokens')
        .select('id, expires_at, initial_sync_completed')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const isFirstConnection = !existingTokens || existingTokens.initial_sync_completed === false;
      console.log('[useGarminAuth] Is first connection:', isFirstConnection, { 
        hasTokens: !!existingTokens, 
        syncCompleted: existingTokens?.initial_sync_completed 
      });

      // Clear any existing connection first if user already has tokens
      if (existingTokens) {
        console.log('[useGarminAuth] Found existing tokens, cleaning up...');
        await supabase
          .from('garmin_tokens')
          .delete()
          .eq('user_id', session.user.id);
        clearStoredTokens();
      }

      // Exchange code for tokens via edge function with authentication
      console.log('[useGarminAuth] About to invoke garmin-oauth with:', {
        code: code.substring(0, 8) + '...',
        codeVerifier: !!pkceData.codeVerifier,
        redirectUri: REDIRECT_URI,
        hasToken: !!session.access_token
      });

      const { data, error } = await supabase.functions.invoke('garmin-oauth', {
        body: JSON.stringify({
          code,
          codeVerifier: pkceData.codeVerifier,
          redirectUri: REDIRECT_URI,
        })
      });

      console.log('[useGarminAuth] Exchange response:', { data, error });

      if (error) {
        console.error('[useGarminAuth] Edge function error:', error);
        // Handle specific OAuth errors with user-friendly messages
        if (error.message?.includes('Invalid authorization code')) {
          throw new Error('Código de autorização inválido. Por favor, tente conectar novamente.');
        } else if (error.message?.includes('already connected')) {
          throw new Error('Conta já conectada. Desconecte primeiro antes de tentar novamente.');
        }
        throw new Error(error.message || 'Failed to exchange code for tokens');
      }

      if (!data?.success) {
        console.error('[useGarminAuth] Token exchange failed:', data?.error);
        // Handle specific OAuth errors
        if (data?.error?.includes('Invalid authorization code')) {
          throw new Error('Código de autorização inválido. Por favor, tente conectar novamente.');
        } else if (data?.error?.includes('already connected')) {
          throw new Error('Conta já conectada. Desconecte primeiro antes de tentar novamente.');
        }
        throw new Error(data?.error || 'Failed to exchange code for tokens');
      }

      console.log('[useGarminAuth] Token exchange successful');

      // Connection established
      setIsConnected(true);
      setIsConnecting(false);

      // Clear PKCE data
      localStorage.removeItem('garmin_pkce');

      console.log('[useGarminAuth] OAuth completed successfully, user is now connected');
      
      // Register webhook automatically after successful OAuth
      try {
        console.log('[useGarminAuth] Registering Garmin webhook...');
        const { data: webhookData, error: webhookError } = await supabase.functions.invoke('register-garmin-webhooks', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          }
        });

        if (webhookError) {
          console.error('[useGarminAuth] Webhook registration failed:', webhookError);
          toast({
            title: "Conectado com sucesso!",
            description: "Sua conta Garmin foi conectada, mas a configuração automática de webhooks falhou. As atividades podem não sincronizar automaticamente.",
            variant: "default",
          });
        } else {
          console.log('[useGarminAuth] Webhook registered successfully:', webhookData);
          
          // If this is the first connection, trigger automatic backfill
          if (isFirstConnection) {
            console.log('[useGarminAuth] First connection detected, triggering auto backfill');
            // Delay the backfill slightly to ensure webhook registration is complete
            setTimeout(async () => {
              await triggerAutoBackfill();
              
              // Mark initial sync as completed after backfill is triggered
              try {
                await supabase
                  .from('garmin_tokens')
                  .update({ initial_sync_completed: true })
                  .eq('user_id', session.user.id);
                console.log('[useGarminAuth] Marked initial sync as completed');
              } catch (error) {
                console.error('[useGarminAuth] Error marking sync completed:', error);
              }
            }, 2000);
          }
          
          toast({
            title: "Conectado com sucesso!",
            description: isFirstConnection 
              ? "Sua conta Garmin foi conectada e configurada. Suas atividades dos últimos 30 dias estão sendo importadas automaticamente via webhook."
              : "Sua conta Garmin foi conectada e configurada para sincronização automática de atividades.",
            variant: "default",
          });
        }
      } catch (webhookErr) {
        console.error('[useGarminAuth] Webhook registration error:', webhookErr);
        toast({
          title: "Conectado com sucesso!",
          description: "Sua conta Garmin foi conectada, mas a configuração de webhooks pode ter falhado. Use a sincronização manual se necessário.",
          variant: "default",
        });
      }

      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error('[useGarminAuth] Error in OAuth callback:', error);
      setIsConnecting(false);
      
      // Clear any partial state
      localStorage.removeItem('garmin_pkce');
      clearStoredTokens();
      setTokens(null);
      setIsConnected(false);
      
      toast({
        title: "Erro na conexão",
        description: error instanceof Error ? error.message : "Erro desconhecido durante a autenticação.",
        variant: "destructive",
      });
      
      // Clear URL parameters even on error
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast, triggerAutoBackfill]);

  const disconnect = useCallback(async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Remove tokens from database
        await supabase
          .from('garmin_tokens')
          .delete()
          .eq('user_id', user.id);
      }

      // Clear localStorage
      clearStoredTokens();
      
      // Reset state
      setTokens(null);
      setIsConnected(false);
      
      toast({
        title: "Desconectado",
        description: "Sua conta Garmin Connect foi desconectada.",
      });
    } catch (error) {
      console.error('[useGarminAuth] Error disconnecting:', error);
      toast({
        title: "Erro",
        description: "Erro ao desconectar da conta Garmin.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const refreshToken = useCallback(async (refreshTokenValue: string) => {
    try {
      console.log('[useGarminAuth] Refreshing token...');
      
      // Get current user and session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('User not authenticated');
      }

      // Call edge function to refresh token
      const { data, error } = await supabase.functions.invoke('garmin-oauth', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: {
          refresh_token: refreshTokenValue,
          grant_type: 'refresh_token'
        }
      });

      if (error || !data.success) {
        throw new Error(data?.error || 'Failed to refresh token');
      }

      const newTokens: GarminTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshTokenValue,
        expires_in: data.expires_in,
        token_type: data.token_type || 'Bearer',
        expires_at: Date.now() + (data.expires_in * 1000) - 600000,
        scope: data.scope || ''
      };

      // No local storage of tokens for security
      setTokens(newTokens);
      
      console.log('[useGarminAuth] Token refreshed successfully');
    } catch (error) {
      console.error('[useGarminAuth] Error refreshing token:', error);
      // If refresh fails, disconnect user
      await disconnect();
      throw error;
    }
  }, [disconnect]);

  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    if (!tokens || Date.now() >= tokens.expires_at) {
      // Try to refresh token
      if (tokens?.refresh_token) {
        try {
          console.log('[useGarminAuth] Token expired, refreshing...');
          await refreshToken(tokens.refresh_token);
          // After refresh, return the new token from state
          return tokens.access_token;
        } catch (error) {
          console.error('[useGarminAuth] Error refreshing token:', error);
          return null;
        }
      }
      return null;
    }
    return tokens.access_token;
  }, [tokens, refreshToken]);

  return {
    isConnected,
    isConnecting,
    tokens,
    startOAuthFlow,
    disconnect,
    getValidAccessToken,
    handleOAuthCallback,
    refreshToken,
  };
};
