import { Header } from '@/components/Header';
import garminLogo from '@/assets/garmin-logo-new.jpg';
import stravaLogo from '@/assets/strava-logo.svg';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useGarminAuth } from '@/hooks/useGarminAuth';
import { useGarminStats } from '@/hooks/useGarminStats';
import { useStravaAuth } from '@/hooks/useStravaAuth';
import { useStravaStats } from '@/hooks/useStravaStats';
import { GarminConnectionStatus } from '@/components/GarminConnectionStatus';
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
  
  // Strava integration
  const { handleStravaConnect, isLoading: stravaConnecting } = useStravaAuth();
  const { data: stravaStats, isLoading: stravaLoading } = useStravaStats();
  
  const stravaConnected = stravaStats?.isConnected || false;
  const stravaActivities = stravaStats?.totalActivities || 0;
  const stravaLastSync = stravaStats?.lastSyncAt || null;
  const disconnectStrava = () => console.log('Strava disconnect'); // TODO: Implement disconnect
  

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

  const stravaSyncStats = {
    lastSync: stravaLoading ? 'Carregando...' : formatLastSync(stravaLastSync),
    activitiesCount: stravaLoading ? 0 : stravaActivities,
    syncStatus: stravaConnected ? ('connected' as const) : ('disconnected' as const)
  };


  const handleConnectGarmin = () => {
    console.log('[GarminSync] Connect button clicked');
    startGarminFlow();
  };

  const handleConnectStrava = () => {
    console.log('[StravaSync] Connect button clicked');
    handleStravaConnect();
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

  const stravaMetrics = [
    { label: 'Atividades Totais', value: stravaSyncStats.activitiesCount, icon: Activity },
    { label: 'Última Sincronização', value: stravaSyncStats.lastSync, icon: Timer },
    { label: 'Segmentos', value: 'Disponível', icon: TrendingUp },
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

          {/* Main Connection Cards */}
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {/* Garmin Connection Card */}
            <ScrollReveal delay={100}>
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex flex-col space-y-4">
                    {/* Garmin Logo */}
                    <div className="flex justify-center">
                      <img 
                        src={garminLogo} 
                        alt="Garmin" 
                        className="h-12 w-auto opacity-90"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-3">
                          <Watch className="h-6 w-6 text-primary" />
                          Garmin Connect
                        </CardTitle>
                        <CardDescription>
                          Conecte sua conta Garmin Connect
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
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
                            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                          >
                            Desconectar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {garminSyncStats.syncStatus === 'disconnected' ? (
                      <>
                        <Alert className="border-blue-500/50 bg-blue-500/10">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-blue-400">
                            Conecte sua conta Garmin Connect para receber insights automáticos
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
                              Conectar Garmin
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Alert className="border-green-500/50 bg-green-500/10">
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription className="text-green-400">
                            <strong>🎉 Conectado!</strong> Sincronização automática ativa.
                          </AlertDescription>
                        </Alert>
                        
                        <div className="grid grid-cols-2 gap-3">
                          {garminMetrics.map((metric, index) => (
                            <div key={index} className="metric-card">
                              <div className="flex items-center gap-2 mb-1">
                                <metric.icon className="h-3 w-3 text-primary" />
                                <span className="text-xs text-muted-foreground">{metric.label}</span>
                              </div>
                              <div className="font-semibold text-sm">{metric.value}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>

            {/* Strava Connection Card */}
            <ScrollReveal delay={150}>
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex flex-col space-y-4">
                    {/* Strava Logo */}
                    <div className="flex justify-center">
                      <img 
                        src={stravaLogo} 
                        alt="Strava" 
                        className="h-12 w-auto opacity-90"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-3">
                          <Activity className="h-6 w-6 text-primary" />
                          Strava
                        </CardTitle>
                        <CardDescription>
                          Conecte sua conta Strava
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={getStatusColor(stravaSyncStats.syncStatus)}>
                          {stravaSyncStats.syncStatus === 'connected' && (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          {stravaSyncStats.syncStatus === 'disconnected' && (
                            <AlertCircle className="h-4 w-4 mr-2" />
                          )}
                          {getStatusText(stravaSyncStats.syncStatus)}
                        </Badge>
                        
                        {stravaConnected && (
                          <Button 
                            onClick={disconnectStrava}
                            variant="outline"
                            size="sm"
                            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                          >
                            Desconectar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stravaSyncStats.syncStatus === 'disconnected' ? (
                      <>
                        <Alert className="border-orange-500/50 bg-orange-500/10">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-orange-400">
                            Conecte sua conta Strava para acessar seus dados de atividades
                          </AlertDescription>
                        </Alert>
                        
                        <Button 
                          onClick={handleConnectStrava}
                          disabled={stravaConnecting}
                          className="w-full bg-orange-600 hover:bg-orange-700"
                          size="lg"
                        >
                          {stravaConnecting ? (
                            <>
                              <Zap className="h-4 w-4 mr-2 animate-pulse" />
                              Conectando...
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4 mr-2" />
                              Conectar Strava
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Alert className="border-green-500/50 bg-green-500/10">
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription className="text-green-400">
                            <strong>🎉 Conectado!</strong> Dados do Strava disponíveis.
                          </AlertDescription>
                        </Alert>
                        
                        <div className="grid grid-cols-2 gap-3">
                          {stravaMetrics.map((metric, index) => (
                            <div key={index} className="metric-card">
                              <div className="flex items-center gap-2 mb-1">
                                <metric.icon className="h-3 w-3 text-primary" />
                                <span className="text-xs text-muted-foreground">{metric.label}</span>
                              </div>
                              <div className="font-semibold text-sm">{metric.value}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>


          {/* Token Refresh Test Button - Only show when Garmin connected */}
          {garminConnected && (
            <ScrollReveal delay={200}>
              <div className="mb-8">
                <TokenRefreshTestButton />
              </div>
            </ScrollReveal>
          )}

          {/* Connection Status - Show for connected devices */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {garminConnected && (
              <ScrollReveal delay={250}>
                <GarminConnectionStatus />
              </ScrollReveal>
            )}
          </div>


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
