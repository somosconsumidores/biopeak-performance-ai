import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStravaAuth } from '@/hooks/useStravaAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lock } from 'lucide-react';

export default function StravaConnect() {
  const [searchParams] = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const { handleStravaConnect, isLoading } = useStravaAuth();
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
  }, [searchParams, navigate]);

  const handleClick = () => {
    if (!userId) return;
    console.log('🚀 [StravaConnect] Starting OAuth flow for user:', userId);
    handleStravaConnect();
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
            Vamos conectar sua conta Strava ao BioPeak para sincronizar suas atividades automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge variant="secondary" className="w-full justify-center py-2">
            <Lock className="w-4 h-4 mr-2" />
            Seguro via OAuth 2.0
          </Badge>
          
          <div className="bg-muted/20 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              Você será redirecionado para o Strava para autorizar a conexão. 
              Suas credenciais nunca são compartilhadas com o BioPeak.
            </p>
          </div>

          <Button 
            onClick={handleClick}
            disabled={isLoading}
            className="w-full bg-[#FC4C02] hover:bg-[#E04402] text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Conectando...
              </>
            ) : (
              'Conectar ao Strava'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
