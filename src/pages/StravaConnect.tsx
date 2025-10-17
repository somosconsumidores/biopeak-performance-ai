import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lock } from 'lucide-react';

export default function StravaConnect() {
  const [searchParams] = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const uid = searchParams.get('user_id');
    
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
    
    // Se for fluxo nativo, iniciar OAuth automaticamente
    const isNativeFlow = localStorage.getItem('strava_connect_flow') === 'native';
    if (isNativeFlow) {
      console.log('🚀 [StravaConnect] Native flow detected, starting OAuth...');
      handleNativeOAuth(uid);
    }
  }, [searchParams, navigate]);

  const handleNativeOAuth = async (uid: string) => {
    try {
      setIsLoading(true);
      console.log('🔑 [StravaConnect] Fetching Strava config...');
      
      // Buscar configuração do Strava
      const { data, error } = await supabase.functions.invoke('strava-config', {
        method: 'GET',
      });

      if (error) throw error;
      if (!data?.clientId || !data?.redirectUri) {
        throw new Error('Invalid Strava configuration');
      }

      console.log('✅ [StravaConnect] Strava config received:', {
        clientId: data.clientId,
        redirectUri: data.redirectUri
      });

      // Gerar state único para segurança
      const state = crypto.randomUUID();
      
      // Salvar state no localStorage e database
      localStorage.setItem('strava_oauth_state', state);
      
      await supabase
        .from('oauth_states')
        .insert({
          state,
          user_id: uid,
          created_at: new Date().toISOString()
        });

      // Construir URL do Strava OAuth
      const stravaAuthUrl = new URL('https://www.strava.com/oauth/authorize');
      stravaAuthUrl.searchParams.set('client_id', data.clientId);
      stravaAuthUrl.searchParams.set('redirect_uri', data.redirectUri);
      stravaAuthUrl.searchParams.set('response_type', 'code');
      stravaAuthUrl.searchParams.set('approval_prompt', 'auto');
      stravaAuthUrl.searchParams.set('scope', 'read,activity:read_all,activity:write');
      stravaAuthUrl.searchParams.set('state', state);

      console.log('🔗 [StravaConnect] Redirecting to Strava OAuth:', stravaAuthUrl.toString());

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
