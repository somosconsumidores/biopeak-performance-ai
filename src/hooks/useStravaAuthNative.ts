import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export const useStravaAuthNative = () => {
  const [isWaitingForAuth, setIsWaitingForAuth] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const connectStravaViaSystemBrowser = useCallback(async () => {
    // 🐛 DEBUG: Alert no início da função
    alert(`🐛 DEBUG connectStravaViaSystemBrowser\n\nChamada iniciada!\nIsNative: ${Capacitor.isNativePlatform()}\nUser ID: ${user?.id || 'null'}`);
    
    if (!Capacitor.isNativePlatform()) {
      alert('🐛 DEBUG: NÃO É NATIVE! Abortando...');
      return;
    }
    if (!user?.id) {
      alert('🐛 DEBUG: SEM USER ID! Abortando...');
      toast({ 
        title: "Erro", 
        description: "Usuário não autenticado",
        variant: "destructive" 
      });
      return;
    }

    setIsWaitingForAuth(true);
    try {
      // Flags de controle para UX
      localStorage.setItem('strava_native_auth_pending', 'true');
      localStorage.setItem('strava_connect_flow', 'native');

      const url = `https://biopeak-ai.com/strava-connect?user_id=${user.id}`;
      
      // 🐛 DEBUG: Alert antes de abrir o browser
      alert(`🐛 DEBUG\n\nVai abrir Browser.open()!\nURL: ${url}`);
      
      console.log('🔗 [StravaAuthNative] Opening Safari View Controller:', url);
      
      // Abrir Safari View Controller (webview integrada)
      await Browser.open({
        url: url,
        presentationStyle: 'popover',
        toolbarColor: '#0f172a',
      });
      
      // 🐛 DEBUG: Alert depois de abrir
      alert('🐛 DEBUG: Browser.open() completou!');

      // Listener para quando o usuário fechar o Safari View manualmente
      Browser.addListener('browserFinished', () => {
        console.log('👋 [StravaAuthNative] User closed Safari View');
      });
      
    } catch (err) {
      console.error('❌ [StravaAuthNative] Browser.open error:', err);
      setIsWaitingForAuth(false);
      toast({ 
        title: 'Erro ao abrir navegador', 
        description: 'Tente novamente.',
        variant: 'destructive'
      });
    }
  }, [user?.id]);

  // Realtime: detectar INSERT/UPDATE na tabela de tokens
  useEffect(() => {
    if (!user?.id || !Capacitor.isNativePlatform()) return;

    console.log('👂 [StravaAuthNative] Starting Realtime listener for user:', user.id);

    const channel = supabase
      .channel('strava-tokens-listener')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT e UPDATE (para reconexão)
          schema: 'public',
          table: 'strava_tokens',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🎉 [StravaAuthNative] Token change detected via Realtime:', {
            eventType: payload.eventType,
            userId: (payload.new as any)?.user_id,
            hasAccessToken: !!(payload.new as any)?.access_token
          });
          
          setIsWaitingForAuth(false);
          localStorage.removeItem('strava_native_auth_pending');
          localStorage.removeItem('strava_connect_flow');

          // Atualiza dados dependentes
          queryClient.invalidateQueries({ queryKey: ['strava-stats'] });
          queryClient.invalidateQueries({ queryKey: ['strava-activities'] });

          toast({
            title: '✅ Strava conectado!',
            description: 'Suas atividades serão sincronizadas automaticamente.',
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 [StravaAuthNative] Channel status:', status);
      });

    return () => {
      console.log('🧹 [StravaAuthNative] Cleaning up Realtime listener');
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Timeout de segurança (5 minutos)
  useEffect(() => {
    if (!isWaitingForAuth) return;

    const timeoutId = setTimeout(() => {
      console.warn('⏱️ [StravaAuthNative] Auth timeout after 5 minutes');
      setIsWaitingForAuth(false);
      localStorage.removeItem('strava_native_auth_pending');
      toast({
        title: 'Tempo esgotado',
        description: 'A autorização não foi completada. Tente novamente.',
        variant: 'destructive'
      });
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearTimeout(timeoutId);
  }, [isWaitingForAuth]);

  return {
    connectStravaViaSystemBrowser,
    isWaitingForAuth,
  };
};
