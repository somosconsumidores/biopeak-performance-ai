
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWebhookOnlyGarminSync } from '@/hooks/useWebhookOnlyGarminSync';
import { 
  Webhook, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Activity,
  Database
} from 'lucide-react';

export function WebhookSyncStatus() {
  const { fetchStats, stats } = useWebhookOnlyGarminSync();

  useEffect(() => {
    fetchStats();
  }, []);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'inactive': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getSyncMethodColor = (method: string) => {
    switch (method) {
      case 'webhook': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'admin_override': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getSyncMethodLabel = (method: string) => {
    switch (method) {
      case 'webhook': return 'Webhook';
      case 'admin_override': return 'Override Admin';
      case 'manual': return 'Manual';
      default: return 'Desconhecido';
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Webhook className="h-6 w-6 text-primary" />
          Status da Sincronização via Webhook
        </CardTitle>
        <CardDescription>
          Monitoramento automático da sincronização Garmin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <Webhook className="h-4 w-4" />
          <AlertDescription className="text-blue-400">
            🚀 <strong>Sincronização Automática Ativa!</strong><br />
            Suas atividades são sincronizadas automaticamente via webhooks da Garmin. 
            Não é necessário fazer sync manual - o sistema detecta novas atividades automaticamente.
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status dos Webhooks:</span>
              <Badge className={getStatusColor(stats.webhookStatus)}>
                {stats.webhookStatus === 'active' && <CheckCircle className="h-4 w-4 mr-2" />}
                {stats.webhookStatus === 'inactive' && <AlertTriangle className="h-4 w-4 mr-2" />}
                {stats.webhookStatus === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Último Método de Sync:</span>
              <Badge className={getSyncMethodColor(stats.lastSyncMethod)}>
                {getSyncMethodLabel(stats.lastSyncMethod)}
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Última Sincronização</span>
              </div>
              <div className="font-semibold">{formatLastSync(stats.lastWebhookSync)}</div>
            </div>

            <div className="metric-card">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Atividades Sincronizadas</span>
              </div>
              <div className="font-semibold">{stats.activitiesCount}</div>
            </div>
          </div>
        </div>

        {stats.webhookStatus === 'inactive' && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-yellow-400">
              <strong>Webhooks inativos:</strong> Configure os webhooks no painel da Garmin Connect IQ para ativar a sincronização automática.
            </AlertDescription>
          </Alert>
        )}

        <div className="pt-4 border-t border-border/50">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>✅ <strong>Automático:</strong> Novas atividades sincronizam instantaneamente</p>
            <p>🛡️ <strong>Rate Limiting:</strong> Máximo 1 sync a cada 5 minutos por usuário</p>
            <p>📊 <strong>Transparente:</strong> Todos os syncs são registrados e auditáveis</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
