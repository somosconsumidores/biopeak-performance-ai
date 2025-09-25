import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, CheckCircle, XCircle, Loader2, Watch, Heart } from 'lucide-react';
import { useHealthKitAuth } from '@/hooks/useHealthKitAuth';
import { useHealthKitSync } from '@/hooks/useHealthKitSync';
import { useQueryClient } from '@tanstack/react-query';
import { AppleHealthIcon } from './AppleHealthIcon';

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
    try {
      const result = await syncActivities();
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['unified-activity-history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    } catch (error) {
      console.error('Sync failed:', error);
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
            <AppleHealthIcon className="h-4 w-4 text-red-500" />
            Apple Health (HealthKit)
          </CardTitle>
          <Badge variant="secondary">Não disponível</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Integração com Apple Health está disponível apenas em dispositivos iOS.
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
            <AppleHealthIcon className="h-4 w-4 text-red-500" />
            Apple Health (HealthKit)
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
              <span>Conecte ao Apple Health para sincronizar atividades do Apple Watch</span>
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
                  Conectando ao Apple Health...
                </>
              ) : (
                <>
                  <Watch className="h-4 w-4 mr-2" />
                  Conectar ao Apple Health
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground">
              Integração com Apple Health para sincronizar dados do Apple Watch automaticamente.
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
          <AppleHealthIcon className="h-4 w-4 text-green-600" />
          Apple Health (HealthKit)
        </CardTitle>
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Conectado ao Apple Health
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {lastSyncResult && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Atividades do Apple Health:</span>
                <span className="font-medium">{lastSyncResult.syncedCount}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Última sincronização com Apple Health: {new Date(lastSyncResult.lastSyncAt).toLocaleString('pt-BR')}
              </div>
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
                  Sincronizando Apple Health...
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 mr-2" />
                  Sincronizar Apple Health
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
            Dados do Apple Watch sincronizados via Apple Health automaticamente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};