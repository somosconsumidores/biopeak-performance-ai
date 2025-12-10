import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { generatePKCE, generateState, buildGarminAuthURL } from '@/lib/garmin-oauth';

// Hardcoded redirect URI - must match Garmin Developer Portal (production)
const GARMIN_REDIRECT_URI = 'https://biopeak-ai.com/garmin-callback';

export const useGarminAuthNative = () => {
  const [isWaitingForAuth, setIsWaitingForAuth] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const connectGarminViaSystemBrowser = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    if (!user?.id) {
      console.error('❌ [GarminAuthNative] User not authenticated');
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado para conectar o Garmin.',
        variant: 'destructive'
      });
      return;
    }

    setIsWaitingForAuth(true);
    try {
      console.log('🔗 [GarminAuthNative] Starting native OAuth flow for user:', user.id);

      // Get client ID from edge function
      const { data: clientData, error: clientError } = await supabase.functions.invoke('garmin-oauth', {
        method: 'GET'
      });

      if (clientError || !clientData?.client_id) {
        console.error('❌ [GarminAuthNative] Error getting client ID:', clientError);
        throw new Error('Não foi possível obter configuração do Garmin');
      }

      const clientId = clientData.client_id;
      console.log('✅ [GarminAuthNative] Got client ID:', clientId);

      // Generate PKCE parameters
      const { codeVerifier, codeChallenge } = await generatePKCE();
      // Include userId in state for public callback processing (format: userId:timestamp)
      const state = `${user.id}:${Date.now()}`;

      console.log('🔐 [GarminAuthNative] Generated PKCE, saving to Supabase...');

      // Save PKCE data to Supabase for the PWA callback to retrieve
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
      
      // Delete any existing PKCE data for this user
      await supabase
        .from('oauth_temp_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', 'garmin_pkce');

      // Insert new PKCE data
      const { error: pkceError } = await supabase
        .from('oauth_temp_tokens')
        .insert({
          user_id: user.id,
          provider: 'garmin_pkce',
          oauth_token: codeVerifier,
          oauth_token_secret: state,
          expires_at: expiresAt
        });

      if (pkceError) {
        console.error('❌ [GarminAuthNative] Error saving PKCE:', pkceError);
        throw new Error('Erro ao preparar autenticação');
      }

      console.log('✅ [GarminAuthNative] PKCE saved to Supabase');

      // Also save to localStorage as backup
      localStorage.setItem('garmin_pkce', JSON.stringify({ codeVerifier, state }));
      localStorage.setItem('garmin_native_auth_pending', 'true');

      // Build authorization URL with hardcoded redirect URI
      const authUrl = buildGarminAuthURL(clientId, GARMIN_REDIRECT_URI, codeChallenge, state);
      
      console.log('🔗 [GarminAuthNative] Opening browser with URL:', authUrl);
      
      // Open Safari View Controller / Chrome Custom Tab
      await Browser.open({
        url: authUrl,
        presentationStyle: 'popover',
        toolbarColor: '#0f172a',
      });

      // Listener for when user closes the browser manually
      Browser.addListener('browserFinished', () => {
        console.log('👋 [GarminAuthNative] User closed browser');
      });
      
    } catch (err) {
      console.error('❌ [GarminAuthNative] Error:', err);
      setIsWaitingForAuth(false);
      localStorage.removeItem('garmin_native_auth_pending');
      toast({ 
        title: 'Erro ao conectar Garmin', 
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive'
      });
    }
  }, [user?.id]);

  // Realtime listener: detect INSERT/UPDATE on garmin_tokens table
  useEffect(() => {
    if (!user?.id || !Capacitor.isNativePlatform()) return;

    console.log('👂 [GarminAuthNative] Starting Realtime listener for user:', user.id);

    const channel = supabase
      .channel('garmin-tokens-native-listener')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT and UPDATE
          schema: 'public',
          table: 'garmin_tokens',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('🎉 [GarminAuthNative] Token change detected via Realtime:', {
            eventType: payload.eventType,
            userId: (payload.new as any)?.user_id,
            hasAccessToken: !!(payload.new as any)?.access_token,
            isActive: (payload.new as any)?.is_active
          });
          
          // Only react if it's an active token
          if (!(payload.new as any)?.is_active) {
            console.log('⚠️ [GarminAuthNative] Token is not active, ignoring');
            return;
          }
          
          setIsWaitingForAuth(false);
          localStorage.removeItem('garmin_native_auth_pending');
          localStorage.removeItem('garmin_pkce');

          // Close the browser
          try {
            await Browser.close();
            console.log('✅ [GarminAuthNative] Browser closed');
          } catch (e) {
            console.log('⚠️ [GarminAuthNative] Could not close browser:', e);
          }

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['garmin-stats'] });
          queryClient.invalidateQueries({ queryKey: ['garmin-activities'] });
          queryClient.invalidateQueries({ queryKey: ['garmin-connection'] });

          toast({
            title: '✅ Garmin conectado!',
            description: 'Suas atividades serão sincronizadas automaticamente.',
          });

          // Trigger automatic backfill to sync activities (30 days)
          console.log('🔄 [GarminAuthNative] Triggering automatic backfill...');
          try {
            const { data: backfillData, error: backfillError } = await supabase.functions.invoke('backfill-activities', {
              body: {
                timeRange: 'last_30_days'
              }
            });
            
            if (backfillError) {
              console.log('⚠️ [GarminAuthNative] Backfill error:', backfillError);
            } else {
              console.log('✅ [GarminAuthNative] Backfill response:', backfillData);
              
              // Check if backfill was already processed (duplicate request)
              const activitiesMsg = backfillData?.activities?.message || '';
              const detailsMsg = backfillData?.activityDetails?.message || '';
              const isDuplicate = activitiesMsg.includes('already') || detailsMsg.includes('already');
              
              if (isDuplicate) {
                toast({
                  title: 'Conta já sincronizada',
                  description: 'Suas atividades históricas já foram importadas anteriormente. Novas atividades serão sincronizadas automaticamente.',
                });
              }
            }
          } catch (e) {
            console.log('⚠️ [GarminAuthNative] Backfill error:', e);
          }

          // Clean up PKCE data from Supabase
          try {
            await supabase
              .from('oauth_temp_tokens')
              .delete()
              .eq('user_id', user.id)
              .eq('provider', 'garmin_pkce');
            console.log('🧹 [GarminAuthNative] PKCE data cleaned up');
          } catch (e) {
            console.log('⚠️ [GarminAuthNative] Could not clean up PKCE:', e);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [GarminAuthNative] Channel status:', status);
      });

    return () => {
      console.log('🧹 [GarminAuthNative] Cleaning up Realtime listener');
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // App state change listener: check for token when app returns from background
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user?.id) return;
    
    let listenerHandle: any = null;

    const setupListener = async () => {
      listenerHandle = await CapApp.addListener('appStateChange', async ({ isActive }: { isActive: boolean }) => {
        if (isActive && isWaitingForAuth) {
          console.log('📱 [GarminAuthNative] App returned to foreground, checking token...');
          
          // Check if token was saved while we were in background
          const { data: token } = await supabase
            .from('garmin_tokens')
            .select('id, is_active')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

          if (token) {
            console.log('✅ [GarminAuthNative] Token found via app state check!');
            setIsWaitingForAuth(false);
            localStorage.removeItem('garmin_native_auth_pending');
            localStorage.removeItem('garmin_pkce');

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ['garmin-stats'] });
            queryClient.invalidateQueries({ queryKey: ['garmin-connection'] });
            queryClient.invalidateQueries({ queryKey: ['garmin-activities'] });

            toast({
              title: '✅ Garmin conectado!',
              description: 'Suas atividades serão sincronizadas automaticamente.',
            });

            // Trigger backfill
            console.log('🔄 [GarminAuthNative] Triggering backfill via app state check...');
            try {
              await supabase.functions.invoke('backfill-activities', {
                body: { timeRange: 'last_30_days' }
              });
              console.log('✅ [GarminAuthNative] Backfill triggered successfully');
            } catch (e) {
              console.log('⚠️ [GarminAuthNative] Backfill error:', e);
            }
          }
        }
      });
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [user?.id, isWaitingForAuth, queryClient]);

  // Security timeout (5 minutes)
  useEffect(() => {
    if (!isWaitingForAuth) return;

    const timeoutId = setTimeout(() => {
      console.warn('⏱️ [GarminAuthNative] Auth timeout after 5 minutes');
      setIsWaitingForAuth(false);
      localStorage.removeItem('garmin_native_auth_pending');
      localStorage.removeItem('garmin_pkce');
      toast({
        title: 'Tempo esgotado',
        description: 'A autorização não foi completada. Tente novamente.',
        variant: 'destructive'
      });
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearTimeout(timeoutId);
  }, [isWaitingForAuth]);

  return {
    connectGarminViaSystemBrowser,
    isWaitingForAuth,
  };
};
