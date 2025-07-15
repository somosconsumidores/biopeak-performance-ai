import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useGarminAuth } from '@/hooks/useGarminAuth';
import { useUnifiedGarminSync } from '@/hooks/useUnifiedGarminSync';
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
  Zap,
  Database,
  ArrowRight
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface SyncStats {
  lastSync: string;
  activitiesCount: number;
  syncStatus: 'connected' | 'disconnected';
}

export function GarminSync() {
  const { isConnected, isConnecting, startOAuthFlow, disconnect } = useGarminAuth();
  const { syncUnified, isLoading: isSyncing, stages, currentStage, lastSyncResult } = useUnifiedGarminSync();
  const { activitiesCount, lastSyncAt, deviceName, loading: statsLoading } = useGarminStats();

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
    console.log('[GarminSync] Starting unified sync...');
    await syncUnified();
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

  const syncMetrics = [
    { label: 'Atividades Totais', value: syncStats.activitiesCount, icon: Activity },
    { label: 'Última Sincronização', value: syncStats.lastSync, icon: Timer },
    { label: 'Frequência Cardíaca', value: '24/7', icon: Heart },
    { label: 'GPS', value: 'Ativo', icon: MapPin },
  ];

  const getStageIcon = (stageName: 'activities' | 'details') => {
    return stageName === 'activities' ? Activity : Database;
  };

  const getStageLabel = (stageName: 'activities' | 'details') => {
    return stageName === 'activities' ? 'Atividades Básicas' : 'Detalhes Recentes';
  };

  const getStageDescription = (stageName: 'activities' | 'details') => {
    return stageName === 'activities' 
      ? 'Sincronizando informações básicas das atividades'
      : 'Sincronizando detalhes das atividades das últimas 24h';
  };

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
                    
                    <div className="space-y-4">
                      {syncStats.syncStatus === 'disconnected' ? (
                        <Button 
                          onClick={handleConnectGarmin}
                          disabled={isConnecting}
                          className="w-full"
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
                        <>
                          <Button 
                            onClick={handleSyncActivities}
                            disabled={isSyncing}
                            className="w-full"
                          >
                            {isSyncing ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Sincronização Inteligente...
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-2" />
                                Sincronização Inteligente
                              </>
                            )}
                          </Button>

                          {/* Progress Section */}
                          {isSyncing && (
                            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                              <div className="text-sm font-medium text-center">
                                Progresso da Sincronização
                              </div>
                              
                              {stages.map((stage, index) => {
                                const StageIcon = getStageIcon(stage.name);
                                const isActive = currentStage.name === stage.name;
                                const isCompleted = stage.status === 'completed';
                                const isError = stage.status === 'error';
                                
                                return (
                                  <div key={stage.name} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                          isCompleted ? 'bg-green-500/20 text-green-400' :
                                          isError ? 'bg-red-500/20 text-red-400' :
                                          isActive ? 'bg-primary/20 text-primary animate-pulse' :
                                          'bg-muted/50 text-muted-foreground'
                                        }`}>
                                          {isCompleted ? (
                                            <CheckCircle className="h-3 w-3" />
                                          ) : isError ? (
                                            <AlertCircle className="h-3 w-3" />
                                          ) : (
                                            <StageIcon className="h-3 w-3" />
                                          )}
                                        </div>
                                        <span className={`text-sm font-medium ${
                                          isActive ? 'text-primary' : 
                                          isCompleted ? 'text-green-400' :
                                          isError ? 'text-red-400' :
                                          'text-muted-foreground'
                                        }`}>
                                          {getStageLabel(stage.name)}
                                        </span>
                                      </div>
                                      {stage.status === 'running' && index < stages.length - 1 && (
                                        <ArrowRight className="h-4 w-4 text-primary animate-pulse" />
                                      )}
                                    </div>
                                    
                                    <div className="text-xs text-muted-foreground pl-8">
                                      {stage.message || getStageDescription(stage.name)}
                                    </div>
                                    
                                    {stage.status === 'running' && stage.progress !== undefined && (
                                      <div className="pl-8">
                                        <Progress value={stage.progress} className="h-1.5" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Results Summary */}
                          {!isSyncing && lastSyncResult && (
                            <div className="p-4 bg-muted/30 rounded-lg border space-y-2">
                              <div className="text-sm font-medium text-center text-green-400">
                                ✓ Última Sincronização Completa
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Atividades: {lastSyncResult.activities.synced}</span>
                                <span>Detalhes: {lastSyncResult.details.synced}</span>
                                <span>Tempo: {Math.round(lastSyncResult.totalDuration / 1000)}s</span>
                              </div>
                            </div>
                          )}
                        </>
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

          {/* Device Card */}
          {deviceName && isConnected && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <ScrollReveal delay={200}>
                <Card className="glass-card">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Watch className="h-6 w-6 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{deviceName}</CardTitle>
                          <CardDescription>Dispositivo</CardDescription>
                        </div>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Conectado
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Última sincronização:</span>
                        <span>{syncStats.lastSync}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
            </div>
          )}

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
                      <Database className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold">2. Sync Inteligente</h3>
                    <p className="text-sm text-muted-foreground">
                      Atividades básicas + detalhes automáticos das últimas 24h
                    </p>
                  </div>
                  
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold">3. Analisar</h3>
                    <p className="text-sm text-muted-foreground">
                      Insights avançados com dados ricos e detalhados
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