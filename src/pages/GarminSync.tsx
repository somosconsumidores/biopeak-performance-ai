import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useGarminAuth } from '@/hooks/useGarminAuth';
import { useGarminStats } from '@/hooks/useGarminStats';
import { usePolarAuth } from '@/hooks/usePolarAuth';
import { usePolarStats } from '@/hooks/usePolarStats';
import { GarminConnectionStatus } from '@/components/GarminConnectionStatus';
import { PolarConnectionStatus } from '@/components/PolarConnectionStatus';
import { TokenRefreshTestButton } from '@/components/TokenRefreshTestButton';

import { 
  Watch, 
  Zap, 
  AlertCircle, 
  CheckCircle,
  Activity,
  Heart,
  Timer,
  MapPin,
  TrendingUp,
  Settings,
  ExternalLink
} from 'lucide-react';

export function GarminSync() {
  const { 
    isConnected: garminConnected, 
    isConnecting: garminConnecting, 
    startOAuthFlow: startGarminFlow, 
    disconnect: disconnectGarmin 
  } = useGarminAuth();
  const { activitiesCount: garminActivities, lastSyncAt: garminLastSync, deviceName: garminDevice, loading: garminLoading } = useGarminStats();
  
  const { 
    isConnected: polarConnected, 
    isConnecting: polarConnecting, 
    startOAuthFlow: startPolarFlow, 
    disconnect: disconnectPolar 
  } = usePolarAuth();
  const { stats: polarStats, isLoading: polarLoading } = usePolarStats();

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

  const garminSyncStats = {
    lastSync: garminLoading ? 'Carregando...' : formatLastSync(garminLastSync),
    activitiesCount: garminLoading ? 0 : garminActivities,
    syncStatus: garminConnected ? ('connected' as const) : ('disconnected' as const)
  };

  const polarSyncStats = {
    lastSync: polarLoading ? 'Carregando...' : formatLastSync(polarStats.lastSyncAt),
    activitiesCount: polarLoading ? 0 : polarStats.activitiesCount,
    syncStatus: polarConnected ? ('connected' as const) : ('disconnected' as const)
  };

  const handleConnectGarmin = () => {
    console.log('[GarminSync] Connect button clicked');
    startGarminFlow();
  };

  const handleConnectPolar = () => {
    console.log('[PolarSync] Connect button clicked');
    startPolarFlow();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'disconnected': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'disconnected': return 'Desconectado';
      default: return 'Desconhecido';
    }
  };

  const garminMetrics = [
    { label: 'Atividades Totais', value: garminSyncStats.activitiesCount, icon: Activity },
    { label: 'Última Sincronização', value: garminSyncStats.lastSync, icon: Timer },
    { label: 'Frequência Cardíaca', value: '24/7', icon: Heart },
    { label: 'GPS', value: 'Ativo', icon: MapPin },
  ];

  const polarMetrics = [
    { label: 'Atividades Totais', value: polarSyncStats.activitiesCount, icon: Activity },
    { label: 'Última Sincronização', value: polarSyncStats.lastSync, icon: Timer },
    { label: 'Frequência Cardíaca', value: '24/7', icon: Heart },
    { label: 'GPS', value: 'Ativo', icon: MapPin },
  ];

  const webhookEndpoint = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/garmin-activities-webhook';

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
                  Sincronização de Dispositivos
                </span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Conecte seus dispositivos de fitness para análise automática de performance
              </p>
            </div>
          </ScrollReveal>

          {/* Main Connection Card */}
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
                      Conecte sua conta Garmin Connect para sincronização automática
                    </CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <Badge className={getStatusColor(garminSyncStats.syncStatus)}>
                      {garminSyncStats.syncStatus === 'connected' && (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {garminSyncStats.syncStatus === 'disconnected' && (
                        <AlertCircle className="h-4 w-4 mr-2" />
                      )}
                      {getStatusText(garminSyncStats.syncStatus)}
                    </Badge>
                    
                    {garminConnected && (
                      <Button 
                        onClick={disconnectGarmin}
                        variant="outline"
                        size="sm"
                        className="text-red-400 border-red-500/30 hover:bg-red-500/10 w-full sm:w-auto"
                      >
                        Desconectar
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {garminSyncStats.syncStatus === 'disconnected' ? (
                      <>
                        <Alert className="border-blue-500/50 bg-blue-500/10">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-blue-400">
                            Conecte sua conta Garmin Connect para começar a receber insights automáticos de suas atividades
                          </AlertDescription>
                        </Alert>
                        
                        <Button 
                          onClick={handleConnectGarmin}
                          disabled={garminConnecting}
                          className="w-full"
                          size="lg"
                        >
                          {garminConnecting ? (
                            <>
                              <Zap className="h-4 w-4 mr-2 animate-pulse" />
                              Conectando...
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4 mr-2" />
                              Conectar Garmin Connect
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Alert className="border-green-500/50 bg-green-500/10">
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription className="text-green-400">
                            <strong>🎉 Conectado com Sucesso!</strong><br />
                            Sua conta Garmin Connect foi conectada e configurada para sincronização automática.
                            Novas atividades serão sincronizadas automaticamente e o histórico dos últimos 30 dias será importado em breve.
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {garminMetrics.map((metric, index) => (
                      <div key={index} className="metric-card">
                        <div className="flex items-center gap-2 mb-2">
                          <metric.icon className="h-4 w-4 text-primary" />
                          <span className="text-xs sm:text-sm text-muted-foreground">{metric.label}</span>
                        </div>
                        <div className="font-semibold text-sm sm:text-base">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Polar Connection Card */}
          <ScrollReveal delay={150}>
            <Card className="glass-card mb-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      <Watch className="h-6 w-6 text-accent" />
                      Conexão Polar
                    </CardTitle>
                    <CardDescription>
                      Conecte sua conta Polar Flow para sincronização automática
                    </CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <Badge className={getStatusColor(polarSyncStats.syncStatus)}>
                      {polarSyncStats.syncStatus === 'connected' && (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {polarSyncStats.syncStatus === 'disconnected' && (
                        <AlertCircle className="h-4 w-4 mr-2" />
                      )}
                      {getStatusText(polarSyncStats.syncStatus)}
                    </Badge>
                    
                    {polarConnected && (
                      <Button 
                        onClick={disconnectPolar}
                        variant="outline"
                        size="sm"
                        className="text-red-400 border-red-500/30 hover:bg-red-500/10 w-full sm:w-auto"
                      >
                        Desconectar
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {polarSyncStats.syncStatus === 'disconnected' ? (
                      <>
                        <Alert className="border-blue-500/50 bg-blue-500/10">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-blue-400">
                            Conecte sua conta Polar Flow para começar a receber insights automáticos de suas atividades
                          </AlertDescription>
                        </Alert>
                        
                        <Button 
                          onClick={handleConnectPolar}
                          disabled={polarConnecting}
                          className="w-full bg-accent hover:bg-accent/90"
                          size="lg"
                        >
                          {polarConnecting ? (
                            <>
                              <Zap className="h-4 w-4 mr-2 animate-pulse" />
                              Conectando...
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4 mr-2" />
                              Conectar Polar Flow
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Alert className="border-green-500/50 bg-green-500/10">
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription className="text-green-400">
                            <strong>🎉 Conectado com Sucesso!</strong><br />
                            Sua conta Polar Flow foi conectada e configurada para sincronização automática.
                            Novas atividades serão sincronizadas automaticamente.
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {polarMetrics.map((metric, index) => (
                      <div key={index} className="metric-card">
                        <div className="flex items-center gap-2 mb-2">
                          <metric.icon className="h-4 w-4 text-accent" />
                          <span className="text-xs sm:text-sm text-muted-foreground">{metric.label}</span>
                        </div>
                        <div className="font-semibold text-sm sm:text-base">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Token Refresh Test Button - Only show when Garmin connected */}
          {garminConnected && (
            <ScrollReveal delay={200}>
              <div className="mb-8">
                <TokenRefreshTestButton />
              </div>
            </ScrollReveal>
          )}

          {/* Connection Status - Show for connected devices */}
          {garminConnected && (
            <ScrollReveal delay={250}>
              <div className="mb-8">
                <GarminConnectionStatus />
              </div>
            </ScrollReveal>
          )}

          {polarConnected && (
            <ScrollReveal delay={300}>
              <div className="mb-8">
                <PolarConnectionStatus />
              </div>
            </ScrollReveal>
          )}

          {/* Device Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {garminDevice && garminConnected && (
              <ScrollReveal delay={350}>
                <Card className="glass-card">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Watch className="h-6 w-6 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{garminDevice}</CardTitle>
                          <CardDescription>Dispositivo Garmin</CardDescription>
                        </div>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Ativo
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Última atividade:</span>
                        <span>{garminSyncStats.lastSync}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
            )}

            {polarStats.deviceName && polarConnected && (
              <ScrollReveal delay={400}>
                <Card className="glass-card">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Watch className="h-6 w-6 text-accent" />
                        <div>
                          <CardTitle className="text-lg">{polarStats.deviceName}</CardTitle>
                          <CardDescription>Dispositivo Polar</CardDescription>
                        </div>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Ativo
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Última atividade:</span>
                        <span>{polarSyncStats.lastSync}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
            )}
          </div>

          {/* How it Works */}
          <ScrollReveal delay={450}>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Como Funciona</CardTitle>
                <CardDescription>
                  Processo para começar a receber insights de suas atividades
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold">1. Conectar</h3>
                    <p className="text-sm text-muted-foreground">
                      Faça login com sua conta Garmin Connect
                    </p>
                  </div>
                  
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                      <Settings className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold">2. Sincronizar</h3>
                    <p className="text-sm text-muted-foreground">
                      Webhooks são configurados automaticamente
                    </p>
                  </div>
                  
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold">3. Treinar</h3>
                    <p className="text-sm text-muted-foreground">
                      Continue suas atividades com seu dispositivo Garmin
                    </p>
                  </div>
                  
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold">4. Insights</h3>
                    <p className="text-sm text-muted-foreground">
                      Receba análises automáticas de performance
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
