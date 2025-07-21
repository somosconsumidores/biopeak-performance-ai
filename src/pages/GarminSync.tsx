
import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useGarminAuth } from '@/hooks/useGarminAuth';
import { useGarminStats } from '@/hooks/useGarminStats';
import { GarminConnectionStatus } from '@/components/GarminConnectionStatus';
import { EmergencySyncButton } from '@/components/EmergencySyncButton';
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
  const { isConnected, isConnecting, startOAuthFlow, disconnect } = useGarminAuth();
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

  const syncMetrics = [
    { label: 'Atividades Totais', value: syncStats.activitiesCount, icon: Activity },
    { label: 'Última Sincronização', value: syncStats.lastSync, icon: Timer },
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
                  Conectar Garmin
                </span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Conecte seu dispositivo Garmin para análise automática de performance
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
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(syncStats.syncStatus)}>
                      {syncStats.syncStatus === 'connected' && (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {syncStats.syncStatus === 'disconnected' && (
                        <AlertCircle className="h-4 w-4 mr-2" />
                      )}
                      {getStatusText(syncStats.syncStatus)}
                    </Badge>
                    
                    {isConnected && (
                      <Button 
                        onClick={disconnect}
                        variant="outline"
                        size="sm"
                        className="text-red-400 border-red-500/30 hover:bg-red-500/10"
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
                    {syncStats.syncStatus === 'disconnected' ? (
                      <>
                        <Alert className="border-blue-500/50 bg-blue-500/10">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-blue-400">
                            Conecte sua conta Garmin Connect para começar a receber insights automáticos de suas atividades
                          </AlertDescription>
                        </Alert>
                        
                        <Button 
                          onClick={handleConnectGarmin}
                          disabled={isConnecting}
                          className="w-full"
                          size="lg"
                        >
                          {isConnecting ? (
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
                            Sua conta Garmin Connect foi conectada. Para sincronização automática,
                            configure os webhooks no painel da Garmin.
                          </AlertDescription>
                        </Alert>

                        <div className="flex justify-end">
                          <EmergencySyncButton />
                        </div>
                      </div>
                    )}
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

          {/* Webhook Configuration Card - Only show when connected */}
          {isConnected && (
            <ScrollReveal delay={150}>
              <Card className="glass-card mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Settings className="h-6 w-6 text-primary" />
                    Configuração de Webhooks
                  </CardTitle>
                  <CardDescription>
                    Configure webhooks no painel da Garmin para sincronização automática
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert className="border-orange-500/50 bg-orange-500/10">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-orange-400">
                      <strong>⚠️ Configuração Manual Necessária</strong><br />
                      Para que as atividades sejam sincronizadas automaticamente, você precisa configurar 
                      o webhook no painel do desenvolvedor da Garmin.
                    </AlertDescription>
                  </Alert>

                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <h4 className="font-semibold text-sm">Passos para Configuração:</h4>
                    <ol className="text-sm space-y-2 text-muted-foreground">
                      <li>1. Acesse o <strong>Garmin Connect Developer Panel</strong></li>
                      <li>2. Vá para a seção de <strong>Webhooks</strong></li>
                      <li>3. Adicione o seguinte endpoint:</li>
                    </ol>
                    
                    <div className="bg-background border rounded p-3">
                      <div className="flex items-center justify-between">
                        <code className="text-sm font-mono break-all">{webhookEndpoint}</code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigator.clipboard.writeText(webhookEndpoint)}
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                        onClick={() => window.open('https://developer.garmin.com', '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir Painel Garmin
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          )}

          {/* Connection Status - Only show when connected */}
          {isConnected && (
            <ScrollReveal delay={200}>
              <div className="mb-8">
                <GarminConnectionStatus />
              </div>
            </ScrollReveal>
          )}

          {/* Device Card */}
          {deviceName && isConnected && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <ScrollReveal delay={300}>
                <Card className="glass-card">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Watch className="h-6 w-6 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{deviceName}</CardTitle>
                          <CardDescription>Dispositivo Conectado</CardDescription>
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
                    <h3 className="font-semibold">2. Configurar</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure webhooks no painel da Garmin (manual)
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
