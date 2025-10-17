import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lock } from 'lucide-react';

export default function StravaConnect() {
  console.log('🔵 [StravaConnect] Component mounted - START');
  
  const [searchParams] = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  console.log('🔵 [StravaConnect] Component rendering', {
    hasSearchParams: !!searchParams,
    userId,
    isLoading,
    url: window.location.href
  });

  useEffect(() => {
    console.log('🔵 [StravaConnect] useEffect triggered');
    
    const uid = searchParams.get('user_id');
    console.log('🔵 [StravaConnect] user_id from params:', uid);
    
    if (!uid) {
      console.error('❌ [StravaConnect] No user_id parameter');
      navigate('/sync');
      return;
    }
    
    // Salvar user_id para uso no OAuth
    localStorage.setItem('strava_connect_user_id', uid);
    localStorage.setItem('strava_oauth_user_id', uid);
    localStorage.setItem('strava_connect_flow', 'native');
    
    setUserId(uid);
    console.log('✅ [StravaConnect] Initialized with user_id:', uid);
    console.log('✅ [StravaConnect] localStorage set:', {
      connect_user_id: localStorage.getItem('strava_connect_user_id'),
      oauth_user_id: localStorage.getItem('strava_oauth_user_id'),
      connect_flow: localStorage.getItem('strava_connect_flow')
    });
    
    // Se for fluxo nativo, iniciar OAuth automaticamente
    const isNativeFlow = localStorage.getItem('strava_connect_flow') === 'native';
    if (isNativeFlow) {
      console.log('🚀 [StravaConnect] Native flow detected, starting OAuth...');
      handleNativeOAuth(uid);
    }
  }, [searchParams, navigate]);

  const handleNativeOAuth = async (uid: string) => {
    console.log('🔵 [StravaConnect] handleNativeOAuth STARTED', { uid });
    
    try {
      setIsLoading(true);
      console.log('🔑 [StravaConnect] Fetching Strava config...');
      
      // Buscar configuração do Strava
      const { data, error } = await supabase.functions.invoke('strava-config', {
        method: 'GET',
      });

      console.log('🔑 [StravaConnect] Strava config response:', { data, error });

      if (error) {
        console.error('❌ [StravaConnect] Strava config error:', error);
        throw error;
      }
      if (!data?.clientId || !data?.redirectUri) {
        console.error('❌ [StravaConnect] Invalid config data:', data);
        throw new Error('Invalid Strava configuration');
      }

      console.log('✅ [StravaConnect] Strava config received:', {
        clientId: data.clientId,
        redirectUri: data.redirectUri
      });

      // Gerar state com user_id embutido (formato: userId:timestamp)
      const state = `${uid}:${Date.now()}`;
      
      // Salvar state APENAS no localStorage (não no banco)
      localStorage.setItem('strava_oauth_state', state);
      console.log('✅ [StravaConnect] State generated:', state.substring(0, 20) + '...');

      // Construir URL do Strava OAuth
      const stravaAuthUrl = new URL('https://www.strava.com/oauth/authorize');
      stravaAuthUrl.searchParams.set('client_id', data.clientId);
      stravaAuthUrl.searchParams.set('redirect_uri', data.redirectUri);
      stravaAuthUrl.searchParams.set('response_type', 'code');
      stravaAuthUrl.searchParams.set('approval_prompt', 'auto');
      stravaAuthUrl.searchParams.set('scope', 'read,activity:read_all,activity:write');
      stravaAuthUrl.searchParams.set('state', state);

      console.log('🔗 [StravaConnect] OAuth URL constructed:', stravaAuthUrl.toString());

      // Redirecionar para Strava (dentro do Safari View Controller)
      window.location.href = stravaAuthUrl.toString();
      
    } catch (err) {
      console.error('❌ [StravaConnect] OAuth setup failed:', err);
      setIsLoading(false);
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#FC4C02] rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">S</span>
            </div>
          </div>
          <CardTitle className="text-2xl">Conectar ao Strava</CardTitle>
          <CardDescription>
            Redirecionando para autorização do Strava...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge variant="secondary" className="w-full justify-center py-2">
            <Lock className="w-4 h-4 mr-2" />
            Seguro via OAuth 2.0
          </Badge>
          
          <div className="bg-muted/20 p-4 rounded-lg flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
