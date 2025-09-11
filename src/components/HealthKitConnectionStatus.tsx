import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, CheckCircle, XCircle, Loader2, Watch, Heart } from 'lucide-react';
import { useHealthKitAuth } from '@/hooks/useHealthKitAuth';
import { useHealthKitSync } from '@/hooks/useHealthKitSync';
import { useQueryClient } from '@tanstack/react-query';

export const HealthKitConnectionStatus: React.FC = () => {
  const { 
    isSupported, 
    hasConnectedDevice, 
    isLoading: authLoading, 
    requestPermissions, 
    disconnect 
  } = useHealthKitAuth();
  
  const { 
    syncActivities, 
    isLoading: syncLoading, 
    lastSyncResult 
  } = useHealthKitSync();
  
  const queryClient = useQueryClient();

  const handleConnect = async () => {
    const success = await requestPermissions();
    if (success) {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['unified-activity-history'] });
    }
  };

  const handleSync = async () => {
    const success = await syncActivities();
    if (success) {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['unified-activity-history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    }
  };

  const handleDisconnect = async () => {
    const success = await disconnect();
    if (success) {
      queryClient.invalidateQueries({ queryKey: ['unified-activity-history'] });
    }
  };

  // Don't render if not supported
  if (!isSupported) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Watch className="h-4 w-4 text-muted-foreground" />
            HealthKit
          </CardTitle>
          <Badge variant="secondary">Não disponível</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            HealthKit está disponível apenas em dispositivos iOS.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasConnectedDevice) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Watch className="h-4 w-4 text-muted-foreground" />
            HealthKit
          </CardTitle>
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Desconectado
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Heart className="h-4 w-4" />
              <span>Conecte seu Apple Watch para sincronizar atividades</span>
            </div>
            
            <Button 
              onClick={handleConnect} 
              disabled={authLoading}
              className="w-full"
              size="sm"
            >
              {authLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <Watch className="h-4 w-4 mr-2" />
                  Conectar HealthKit
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground">
              Sincronize atividades do seu Apple Watch automaticamente.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Watch className="h-4 w-4 text-green-600" />
          HealthKit
        </CardTitle>
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Conectado
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {lastSyncResult && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Atividades sincronizadas:</span>
                <span className="font-medium">{lastSyncResult.synced}</span>
              </div>
              {lastSyncResult.lastSyncAt && (
                <div className="text-xs text-muted-foreground">
                  Última sincronização: {lastSyncResult.lastSyncAt.toLocaleString('pt-BR')}
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            <Button 
              onClick={handleSync} 
              disabled={syncLoading}
              size="sm"
              className="flex-1"
            >
              {syncLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 mr-2" />
                  Sincronizar
                </>
              )}
            </Button>
            
            <Button 
              onClick={handleDisconnect} 
              disabled={authLoading}
              size="sm"
              variant="outline"
            >
              Desconectar
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Dados do Apple Watch são sincronizados automaticamente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};