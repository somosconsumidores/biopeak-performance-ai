import { Header } from '@/components/Header';
import garminLogo from '@/assets/garmin-logo-updated.png';
import stravaLogo from '@/assets/strava-logo.svg';
import polarLogo from '@/assets/polar-logo.png';

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
import { usePolarAuth } from '@/hooks/usePolarAuth';
import { usePolarStats } from '@/hooks/usePolarStats';
import { useHealthKitAuth } from '@/hooks/useHealthKitAuth';
import { useHealthKitSync } from '@/hooks/useHealthKitSync';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GarminConnectionStatus } from '@/components/GarminConnectionStatus';
import { PolarConnectionStatus } from '@/components/PolarConnectionStatus';
import { StravaGpxImport } from '@/components/StravaGpxImport';
import { ZeppGpxImport } from '@/components/ZeppGpxImport';

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Detect Strava callback that might have landed on /sync instead of /strava-callback
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const scope = searchParams.get('scope');
    
    // Check if this looks like a Strava callback (has scope parameter with Strava-specific values)
    if (code && state && scope && scope.includes('activity:read_all')) {
      console.log('🔄 Detected Strava callback on /sync route, redirecting to /strava-callback');
      console.log('🔄 Callback params:', { code: code.substring(0, 10) + '...', state: state.substring(0, 10) + '...', scope });
      
      // Redirect to the correct Strava callback page with all parameters
      const newUrl = `/strava-callback?${searchParams.toString()}`;
      navigate(newUrl, { replace: true });
      return;
    }
  }, [searchParams, navigate]);
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
  
  // Polar integration
  const { 
    isConnected: polarConnected, 
    isConnecting: polarConnecting, 
    startOAuthFlow: startPolarFlow, 
    disconnect: disconnectPolar 
  } = usePolarAuth();
  const { stats: polarStats, isLoading: polarLoading } = usePolarStats();
  
  const polarActivities = polarStats?.activitiesCount || 0;
  const polarLastSync = polarStats?.lastSyncAt || null;
  
  // Apple Health integration
  const { 
    isSupported: healthKitSupported,
    hasConnectedDevice: healthKitConnected,
    isLoading: healthKitConnecting,
    requestPermissions: connectHealthKit,
    disconnect: disconnectHealthKit 
  } = useHealthKitAuth();
  const { 
    syncActivities: syncHealthKitActivities,
    isLoading: healthKitSyncing,
    lastSyncResult: healthKitLastSync 
  } = useHealthKitSync();
  const disconnectStrava = async () => {
    console.log('Strava disconnect');
    try {
      if (!user) return;
      
      // Remove tokens from database
      const { error } = await supabase
        .from('strava_tokens')
        .delete()
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error disconnecting Strava:', error);
        toast({
          title: "Erro ao desconectar",
          description: "Não foi possível desconectar do Strava",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Desconectado com sucesso!",
        description: "Sua conta do Strava foi desconectada",
      });
      
      // Force refresh of stats
      window.location.reload();
    } catch (error) {
      console.error('Error disconnecting Strava:', error);
      toast({
        title: "Erro ao desconectar",
        description: "Erro inesperado ao desconectar do Strava",
        variant: "destructive",
      });
    }
  };
  

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

  const polarSyncStats = {
    lastSync: polarLoading ? 'Carregando...' : formatLastSync(polarLastSync),
    activitiesCount: polarLoading ? 0 : polarActivities,
    syncStatus: polarConnected ? ('connected' as const) : ('disconnected' as const)
  };


  const handleConnectGarmin = () => {
    console.log('[GarminSync] Connect button clicked');
    startGarminFlow();
  };

  const handleConnectStrava = () => {
    console.log('[StravaSync] Connect button clicked');
    handleStravaConnect();
  };

  const handleConnectPolar = () => {
    console.log('[PolarSync] Connect button clicked');
    startPolarFlow();
  };

  const handleConnectHealthKit = async () => {
    console.log('[HealthKitSync] Connect button clicked');
    await connectHealthKit();
  };

  const handleSyncHealthKit = async () => {
    console.log('[HealthKitSync] Sync button clicked');
    await syncHealthKitActivities();
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

  const polarMetrics = [
    { label: 'Atividades Totais', value: polarSyncStats.activitiesCount, icon: Activity },
    { label: 'Última Sincronização', value: polarSyncStats.lastSync, icon: Timer },
    { label: 'Frequência Cardíaca', value: '24/7', icon: Heart },
    { label: 'GPS', value: 'Ativo', icon: MapPin },
  ];

  const healthKitSyncStats = {
    lastSync: healthKitLastSync ? formatLastSync(healthKitLastSync.lastSyncAt) : 'Nunca sincronizado',
    activitiesCount: healthKitLastSync?.syncedCount || 0,
    syncStatus: healthKitConnected ? ('connected' as const) : ('disconnected' as const)
  };

  const healthKitMetrics = [
    { label: 'Atividades Totais', value: healthKitSyncStats.activitiesCount, icon: Activity },
    { label: 'Última Sincronização', value: healthKitSyncStats.lastSync, icon: Timer },
    { label: 'Frequência Cardíaca', value: '24/7', icon: Heart },
    { label: 'GPS', value: 'Ativo', icon: MapPin },
  ];


  const webhookEndpoint = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/garmin-activities-webhook';

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="safe-pt-20 pb-8 px-4 sm:px-6 lg:px-8 relative z-10">
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
          <div className="grid lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
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
                    
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-start gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-3">
                          <Watch className="h-6 w-6 text-primary" />
                          Garmin Connect
                        </CardTitle>
                        <CardDescription>
                          Conecte sua conta Garmin Connect
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2 justify-self-end">
                        <Badge className={`${getStatusColor(garminSyncStats.syncStatus)} text-xs px-2 py-1`}>
                          {garminSyncStats.syncStatus === 'connected' && (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          )}
                          {garminSyncStats.syncStatus === 'disconnected' && (
                            <AlertCircle className="h-3 w-3 mr-1" />
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
                    
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-start gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-3">
                          <Activity className="h-6 w-6 text-primary" />
                          Strava
                        </CardTitle>
                        <CardDescription>
                          Conecte sua conta Strava
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2 justify-self-end">
                        <Badge className={`${getStatusColor(stravaSyncStats.syncStatus)} text-xs px-2 py-1`}>
                          {stravaSyncStats.syncStatus === 'connected' && (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          )}
                          {stravaSyncStats.syncStatus === 'disconnected' && (
                            <AlertCircle className="h-3 w-3 mr-1" />
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

            {/* Polar Connection Card */}
            <ScrollReveal delay={200}>
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex flex-col space-y-4">
                    {/* Polar Logo */}
                    <div className="flex justify-center">
                      <img 
                        src="/lovable-uploads/d0e13ad3-b240-4821-96b9-1074c42bf4e0.png" 
                        alt="Polar Flow" 
                        className="h-12 w-auto opacity-90"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-start gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-3">
                          <Heart className="h-6 w-6 text-primary" />
                          Polar Flow
                        </CardTitle>
                        <CardDescription>
                          Conecte sua conta Polar Flow
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2 justify-self-end">
                        <Badge className={`${getStatusColor(polarSyncStats.syncStatus)} text-xs px-2 py-1`}>
                          {polarSyncStats.syncStatus === 'connected' && (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          )}
                          {polarSyncStats.syncStatus === 'disconnected' && (
                            <AlertCircle className="h-3 w-3 mr-1" />
                          )}
                          {getStatusText(polarSyncStats.syncStatus)}
                        </Badge>
                        
                        {polarConnected && (
                          <Button 
                            onClick={disconnectPolar}
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
                    {polarSyncStats.syncStatus === 'disconnected' ? (
                      <>
                        <Alert className="border-purple-500/50 bg-purple-500/10">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-purple-400">
                            Conecte sua conta Polar Flow para acessar seus dados de atividades
                          </AlertDescription>
                        </Alert>
                        
                        <Button 
                          onClick={handleConnectPolar}
                          disabled={polarConnecting}
                          className="w-full bg-purple-600 hover:bg-purple-700"
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
                              Conectar Polar
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Alert className="border-green-500/50 bg-green-500/10">
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription className="text-green-400">
                            <strong>🎉 Conectado!</strong> Dados do Polar disponíveis.
                          </AlertDescription>
                        </Alert>
                        
                        <div className="grid grid-cols-2 gap-3">
                          {polarMetrics.map((metric, index) => (
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

            {/* Apple Health Connection Card */}
            <ScrollReveal delay={200}>
                <Card className="glass-card">
                  <CardHeader>
                    <div className="flex flex-col space-y-4">
                      {/* Apple Health Logo */}
                      <div className="flex justify-center">
                        <img 
                          src="https://static.wixstatic.com/media/a025ad_18a486e8d8544c5481fa62c82331fbfc~mv2.png" 
                          alt="Works with Apple Health official logo" 
                          className="h-12 w-auto opacity-90"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          width={192}
                          height={48}
                          onError={(e) => {
                            console.warn('Apple Health logo failed to load, falling back to local asset');
                            e.currentTarget.src = '/works-with-apple-health-logo.png';
                          }}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-start gap-2">
                        <div>
                          <CardTitle className="flex items-center gap-3">
                            <Heart className="h-6 w-6 text-red-500" />
                            Apple Health
                          </CardTitle>
                          <CardDescription>
                            Conecte sua conta Apple Health
                          </CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-2 justify-self-end">
                          <Badge className={`${getStatusColor(healthKitSyncStats.syncStatus)} text-xs px-2 py-1`}>
                            {healthKitSyncStats.syncStatus === 'connected' && (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            )}
                            {healthKitSyncStats.syncStatus === 'disconnected' && (
                              <AlertCircle className="h-3 w-3 mr-1" />
                            )}
                            {getStatusText(healthKitSyncStats.syncStatus)}
                          </Badge>
                          
                          {healthKitConnected && (
                            <Button 
                              onClick={disconnectHealthKit}
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
                      {!healthKitSupported ? (
                        <>
                          <Alert className="border-amber-500/50 bg-amber-500/10">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-amber-400">
                              Apple Health está disponível apenas em dispositivos iOS com o app nativo
                            </AlertDescription>
                          </Alert>
                          
                          <Button 
                            disabled={true}
                            className="w-full bg-red-500/50 cursor-not-allowed"
                            size="lg"
                          >
                            <Heart className="h-4 w-4 mr-2" />
                            Disponível apenas no iOS
                          </Button>
                        </>
                      ) : healthKitSyncStats.syncStatus === 'disconnected' ? (
                        <>
                          <Alert className="border-red-500/50 bg-red-500/10">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-red-400">
                              Conecte sua conta Apple Health para sincronizar atividades do Apple Watch
                            </AlertDescription>
                          </Alert>
                          
                          <Button 
                            onClick={handleConnectHealthKit}
                            disabled={healthKitConnecting}
                            className="w-full bg-red-500 hover:bg-red-600"
                            size="lg"
                          >
                            {healthKitConnecting ? (
                              <>
                                <Zap className="h-4 w-4 mr-2 animate-pulse" />
                                Conectando...
                              </>
                            ) : (
                              <>
                                <Heart className="h-4 w-4 mr-2" />
                                Conectar Apple Health
                              </>
                            )}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Alert className="border-green-500/50 bg-green-500/10">
                            <CheckCircle className="h-4 w-4" />
                            <AlertDescription className="text-green-400">
                              <strong>🎉 Conectado!</strong> Dados do Apple Watch disponíveis.
                            </AlertDescription>
                          </Alert>
                          
                          <div className="grid grid-cols-2 gap-3">
                            {healthKitMetrics.map((metric, index) => (
                              <div key={index} className="metric-card">
                                <div className="flex items-center gap-2 mb-1">
                                  <metric.icon className="h-3 w-3 text-primary" />
                                  <span className="text-xs text-muted-foreground">{metric.label}</span>
                                </div>
                                <div className="font-semibold text-sm">{metric.value}</div>
                              </div>
                            ))}
                          </div>

                          <Button 
                            onClick={handleSyncHealthKit}
                            disabled={healthKitSyncing}
                            className="w-full"
                            variant="outline"
                            size="sm"
                          >
                            {healthKitSyncing ? (
                              <>
                                <Zap className="h-4 w-4 mr-2 animate-pulse" />
                                Sincronizando...
                              </>
                            ) : (
                              <>
                                <Activity className="h-4 w-4 mr-2" />
                                Sincronizar Agora
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
          </div>



          {/* Import GPX Section */}
          <div className="mb-8 space-y-6">
            <ScrollReveal delay={220}>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">
                  <span className="bg-gradient-primary bg-clip-text text-transparent">
                    Importar Arquivos GPX
                  </span>
                </h2>
                <p className="text-muted-foreground">
                  Importe arquivos GPX do Strava ou Zepp para análise de performance
                </p>
              </div>
            </ScrollReveal>
            
            <div className="grid lg:grid-cols-2 gap-6">
              <ScrollReveal delay={240}>
                <StravaGpxImport />
              </ScrollReveal>
              
              <ScrollReveal delay={260}>
                <ZeppGpxImport />
              </ScrollReveal>
            </div>
          </div>

          {/* Connection Status - Show for connected devices */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {garminConnected && (
              <ScrollReveal delay={250}>
                <GarminConnectionStatus />
              </ScrollReveal>
            )}
            {polarConnected && (
              <ScrollReveal delay={300}>
                <PolarConnectionStatus />
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
