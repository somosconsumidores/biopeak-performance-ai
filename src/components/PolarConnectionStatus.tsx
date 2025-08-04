import { AlertCircle, Activity, Clock, Smartphone, Webhook } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePolarStats } from "@/hooks/usePolarStats";
import { usePolarAuth } from "@/hooks/usePolarAuth";

const formatLastSync = (syncAt: string | null): string => {
  if (!syncAt) return "Nunca";
  
  const syncDate = new Date(syncAt);
  const now = new Date();
  const diffMs = now.getTime() - syncDate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minuto(s) atrás`;
  }
  
  if (diffHours < 24) {
    return `${diffHours} hora(s) atrás`;
  }
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} dia(s) atrás`;
};

export function PolarConnectionStatus() {
  const { stats, isLoading } = usePolarStats();
  const { webhookRegistered, isRegisteringWebhook, registerWebhook } = usePolarAuth();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const connectionStatus = stats.activitiesCount > 0 ? 'active' : 'awaiting';

  return (
    <div className="space-y-4">
      <Alert className={connectionStatus === 'active' ? 'border-success' : 'border-warning'}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {connectionStatus === 'active' ? (
            <>
              <strong>Conexão ativa:</strong> Sua conta Polar está conectada e sincronizando automaticamente.
            </>
          ) : (
            <>
              <strong>Aguardando atividades:</strong> Conta Polar conectada. Faça uma atividade para começar a sincronização.
            </>
          )}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atividades</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activitiesCount}</div>
            <p className="text-xs text-muted-foreground">
              Total sincronizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Sincronização</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLastSync(stats.lastSyncAt)}</div>
            <p className="text-xs text-muted-foreground">
              Sincronização automática
            </p>
          </CardContent>
        </Card>

        {stats.deviceName && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dispositivo</CardTitle>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold truncate">{stats.deviceName}</div>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  Polar
                </Badge>
                {stats.polarUserId && (
                  <Badge variant="outline" className="text-xs">
                    ID: {stats.polarUserId}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {!webhookRegistered && (
        <Alert className="border-warning">
          <Webhook className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong>Webhook não configurado:</strong> Para receber atividades automaticamente, você precisa configurar o webhook da Polar.
            </div>
            <Button 
              onClick={registerWebhook}
              disabled={isRegisteringWebhook}
              size="sm"
              variant="outline"
            >
              {isRegisteringWebhook ? 'Configurando...' : 'Configurar Webhook'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Alert className={webhookRegistered ? 'border-success' : undefined}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {webhookRegistered ? (
            <>
              <strong>Webhook configurado:</strong> Suas atividades Polar são sincronizadas automaticamente após cada treino.
            </>
          ) : (
            <>
              <strong>Sincronização manual:</strong> Configure o webhook acima para sincronização automática das atividades.
            </>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}