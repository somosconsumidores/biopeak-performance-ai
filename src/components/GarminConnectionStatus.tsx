
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGarminStats } from '@/hooks/useGarminStats';
import { 
  Watch, 
  CheckCircle, 
  AlertCircle,
  Activity,
  Clock
} from 'lucide-react';

export function GarminConnectionStatus() {
  const { activitiesCount, lastSyncAt, deviceName, loading } = useGarminStats();

  const formatLastSync = (syncAt: string | null) => {
    if (!syncAt) return 'Nunca sincronizado';
    
    const date = new Date(syncAt);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return 'Há poucos minutos';
    if (diffInHours < 24) return `Há ${Math.floor(diffInHours)} horas`;
    
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const connectionStatus = activitiesCount > 0 ? 'connected' : 'disconnected';

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Watch className="h-6 w-6 text-primary" />
          Status da Sincronização
        </CardTitle>
        <CardDescription>
          Suas atividades Garmin são sincronizadas automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connectionStatus === 'connected' ? (
          <Alert className="border-green-500/50 bg-green-500/10">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-green-400">
              <strong>✅ Sincronização Ativa!</strong><br />
              Suas atividades são detectadas e sincronizadas automaticamente.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-yellow-400">
              <strong>⚠️ Aguardando Atividades</strong><br />
              Conecte-se e registre suas primeiras atividades no Garmin Connect.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="metric-card">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total de Atividades</span>
            </div>
            <div className="font-semibold text-2xl">
              {loading ? '...' : activitiesCount}
            </div>
          </div>

          <div className="metric-card">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Última Atividade</span>
            </div>
            <div className="font-semibold">
              {loading ? 'Carregando...' : formatLastSync(lastSyncAt)}
            </div>
          </div>
        </div>

        {deviceName && (
          <div className="pt-2 border-t border-border/50">
            <div className="text-sm text-muted-foreground">
              <strong>Dispositivo:</strong> {deviceName}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border/50">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>🔄 <strong>Automático:</strong> Novas atividades aparecem em poucos minutos</p>
            <p>📊 <strong>Dados Completos:</strong> Métricas, GPS e frequência cardíaca</p>
            <p>🎯 <strong>Insights:</strong> Análises avançadas de performance</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
