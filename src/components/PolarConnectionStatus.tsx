import { AlertCircle, Activity, Clock, Smartphone } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePolarStats } from "@/hooks/usePolarStats";

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

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Sincronização automática:</strong> Suas atividades Polar são sincronizadas automaticamente 
          após cada treino. Não é necessário sincronização manual.
        </AlertDescription>
      </Alert>
    </div>
  );
}