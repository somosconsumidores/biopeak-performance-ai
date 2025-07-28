import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Calendar, Clock, Zap } from "lucide-react";
import { useStravaAuth } from "@/hooks/useStravaAuth";
import { useStravaStats } from "@/hooks/useStravaStats";
import { useStravaSync } from "@/hooks/useStravaSync";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const StravaConnectionStatus = () => {
  const { handleStravaConnect, isLoading: isConnecting } = useStravaAuth();
  const { data: stats, isLoading: isLoadingStats } = useStravaStats();
  const { syncActivities, isLoading: isSyncing, lastSyncResult } = useStravaSync();

  const handleSync = async () => {
    const success = await syncActivities();
    if (success) {
      // Refresh stats after successful sync
      window.location.reload();
    }
  };

  if (isLoadingStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            Strava
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Carregando status...</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats?.isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            Strava
          </CardTitle>
          <CardDescription>
            Conecte sua conta do Strava para sincronizar suas atividades
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Desconectado</Badge>
          </div>
          
          <Button 
            onClick={handleStravaConnect} 
            disabled={isConnecting}
            className="w-full bg-orange-500 hover:bg-orange-600"
          >
            {isConnecting ? "Conectando..." : "Conectar ao Strava"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          Strava
        </CardTitle>
        <CardDescription>
          Sua conta está conectada e sincronizando atividades
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="bg-green-500">
            Conectado
          </Badge>
          {stats.syncStatus === 'in_progress' && (
            <Badge variant="secondary">
              <Zap className="w-3 h-3 mr-1" />
              Sincronizando
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{stats.totalActivities}</p>
              <p className="text-xs text-muted-foreground">Atividades</p>
            </div>
          </div>
          
          {stats.lastSyncAt && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {formatDistanceToNow(new Date(stats.lastSyncAt), { 
                    addSuffix: true,
                    locale: ptBR 
                  })}
                </p>
                <p className="text-xs text-muted-foreground">Última sync</p>
              </div>
            </div>
          )}
        </div>

        {lastSyncResult && (
          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-200">
              {lastSyncResult.message}
            </p>
          </div>
        )}

        <Button 
          onClick={handleSync}
          disabled={isSyncing || stats.syncStatus === 'in_progress'}
          variant="outline"
          className="w-full"
        >
          {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
        </Button>
      </CardContent>
    </Card>
  );
};