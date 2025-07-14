import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useGarminAuth } from '@/hooks/useGarminAuth';
import { useGarminSync } from '@/hooks/useGarminSync';
import { useGarminStats } from '@/hooks/useGarminStats';
import { 
  Watch, 
  Smartphone, 
  Activity, 
  Heart,
  Timer,
  MapPin,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Zap
} from 'lucide-react';

interface SyncStats {
  lastSync: string;
  activitiesCount: number;
  syncStatus: 'connected' | 'disconnected';
}

export function GarminSync() {
  const { isConnected, isConnecting, startOAuthFlow, disconnect } = useGarminAuth();
  const { syncActivities, isLoading: isSyncing, lastSyncResult } = useGarminSync();
  const { activitiesCount, lastSyncAt, loading: statsLoading } = useGarminStats();

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

  const syncStats = {
    lastSync: statsLoading ? 'Carregando...' : formatLastSync(lastSyncAt),
    activitiesCount: statsLoading ? 0 : activitiesCount,
    syncStatus: isConnected ? ('connected' as const) : ('disconnected' as const)
  };

  const handleConnectGarmin = () => {
    console.log('[GarminSync] Connect button clicked');
    startOAuthFlow();
  };

  const handleSyncActivities = async () => {
    console.log('[GarminSync] Starting sync activities...');
    await syncActivities();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'syncing': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'disconnected': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'syncing': return 'Sincronizando...';
      case 'disconnected': return 'Desconectado';
      default: return 'Desconhecido';
    }
  };

  const garminDevices = [
    { name: 'Forerunner 955', type: 'watch', connected: true },
    { name: 'Edge 830', type: 'bike', connected: false },
    { name: 'Fenix 7', type: 'watch', connected: true },
  ];

  const syncMetrics = [
    { label: 'Atividades Totais', value: syncStats.activitiesCount, icon: Activity },
    { label: 'Última Sincronização', value: syncStats.lastSync, icon: Timer },
    { label: 'Frequência Cardíaca', value: '24/7', icon: Heart },
    { label: 'GPS', value: 'Ativo', icon: MapPin },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="pt-20 pb-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <ScrollReveal>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4">
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  Sincronização Garmin
                </span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Conecte seus dispositivos Garmin para análise inteligente de performance
              </p>
            </div>
          </ScrollReveal>

          {/* Status Card */}
          <ScrollReveal delay={100}>
            <Card className="glass-card mb-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      <Watch className="h-6 w-6 text-primary" />
                      Status da Conexão
                    </CardTitle>
                    <CardDescription>
                      Monitore o status da sua conexão com Garmin Connect
                    </CardDescription>
                  </div>
                   <Badge className={getStatusColor(syncStats.syncStatus)}>
                    {syncStats.syncStatus === 'connected' && (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    {syncStats.syncStatus === 'disconnected' && (
                      <AlertCircle className="h-4 w-4 mr-2" />
                    )}
                    {getStatusText(syncStats.syncStatus)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {syncStats.syncStatus === 'disconnected' && (
                      <Alert className="border-yellow-500/50 bg-yellow-500/10">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-yellow-400">
                          Conecte sua conta Garmin para sincronizar suas atividades
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="flex gap-4">
                      {syncStats.syncStatus === 'disconnected' ? (
                        <Button 
                          onClick={handleConnectGarmin}
                          disabled={isConnecting}
                          className="flex-1"
                        >
                          {isConnecting ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Conectando...
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4 mr-2" />
                              Conectar Garmin
                            </>
                          )}
                        </Button>
                       ) : (
                        <Button 
                          onClick={handleSyncActivities}
                          disabled={isSyncing}
                          className="flex-1"
                        >
                          {isSyncing ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Sincronizando...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Sincronizar Agora
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {syncMetrics.map((metric, index) => (
                      <div key={index} className="metric-card">
                        <div className="flex items-center gap-2 mb-2">
                          <metric.icon className="h-4 w-4 text-primary" />
                          <span className="text-sm text-muted-foreground">{metric.label}</span>
                        </div>
                        <div className="font-semibold">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Devices Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {garminDevices.map((device, index) => (
              <ScrollReveal key={index} delay={200 + (index * 100)}>
                <Card className="glass-card">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {device.type === 'watch' ? (
                          <Watch className="h-6 w-6 text-primary" />
                        ) : (
                          <Smartphone className="h-6 w-6 text-primary" />
                        )}
                        <div>
                          <CardTitle className="text-lg">{device.name}</CardTitle>
                          <CardDescription className="capitalize">{device.type}</CardDescription>
                        </div>
                      </div>
                      <Badge className={device.connected ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                        {device.connected ? 'Conectado' : 'Offline'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Última atividade:</span>
                        <span>{device.connected ? 'Hoje, 14:30' : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bateria:</span>
                        <span>{device.connected ? '85%' : 'N/A'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>

          {/* How it Works */}
          <ScrollReveal delay={400}>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Como Funciona a Sincronização</CardTitle>
                <CardDescription>
                  Entenda o processo de integração com seus dispositivos Garmin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold">1. Conectar</h3>
                    <p className="text-sm text-muted-foreground">
                      Autorize o BioPeak a acessar seus dados do Garmin Connect
                    </p>
                  </div>
                  
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                      <Download className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold">2. Sincronizar</h3>
                    <p className="text-sm text-muted-foreground">
                      Importe automaticamente todas as suas atividades e métricas
                    </p>
                  </div>
                  
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold">3. Analisar</h3>
                    <p className="text-sm text-muted-foreground">
                      Receba insights inteligentes baseados nos seus dados
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}