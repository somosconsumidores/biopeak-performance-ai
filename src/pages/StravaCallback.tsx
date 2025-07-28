import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStravaAuth } from '@/hooks/useStravaAuth';
import { useStravaSync } from '@/hooks/useStravaSync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function StravaCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useStravaAuth();
  const { syncActivities } = useStravaSync();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processando autenticação...');

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setMessage(`Erro na autorização: ${error}`);
        setTimeout(() => navigate('/sync'), 3000);
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setMessage('Parâmetros de autorização ausentes');
        setTimeout(() => navigate('/sync'), 3000);
        return;
      }

      try {
        setMessage('Autenticando com o Strava...');
        const authSuccess = await handleCallback(code, state);
        
        if (!authSuccess) {
          setStatus('error');
          setMessage('Falha na autenticação');
          setTimeout(() => navigate('/sync'), 3000);
          return;
        }

        setMessage('Autenticação concluída! Iniciando sincronização...');
        
        // Start automatic sync after successful authentication
        const syncSuccess = await syncActivities();
        
        if (syncSuccess) {
          setStatus('success');
          setMessage('Strava conectado e sincronizado com sucesso!');
        } else {
          setStatus('success');
          setMessage('Strava conectado! A sincronização pode ser feita manualmente.');
        }
        
        setTimeout(() => navigate('/sync'), 2000);
        
      } catch (error) {
        console.error('Callback processing error:', error);
        setStatus('error');
        setMessage('Erro inesperado durante o processamento');
        setTimeout(() => navigate('/sync'), 3000);
      }
    };

    processCallback();
  }, [searchParams, handleCallback, syncActivities, navigate]);

  const getIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-8 h-8 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <XCircle className="w-8 h-8 text-red-500" />;
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
        <CardContent className="text-center">
          {status === 'processing' && (
            <p className="text-sm text-muted-foreground">
              Aguarde enquanto processamos sua autenticação...
            </p>
          )}
          {status === 'success' && (
            <p className="text-sm text-muted-foreground">
              Redirecionando para a página de sincronização...
            </p>
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