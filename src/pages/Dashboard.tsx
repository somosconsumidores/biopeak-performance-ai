import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Target,
  Calendar,
  Clock,
  Heart,
  Zap,
  Award,
  BarChart3,
  Loader2
} from 'lucide-react';

export const Dashboard = () => {
  const { 
    metrics, 
    weeklyData, 
    alerts, 
    recentActivities, 
    peakPerformance, 
    loading, 
    error 
  } = useDashboardMetrics();

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Carregando métricas...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-yellow-500" />
                <p className="text-muted-foreground">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formattedMetrics = metrics ? [
    {
      title: 'VO₂ Max',
      value: metrics.vo2Max.current ? metrics.vo2Max.current.toFixed(1) : 'N/A',
      unit: 'ml/kg/min',
      change: metrics.vo2Max.current ? `${metrics.vo2Max.change > 0 ? '+' : ''}${metrics.vo2Max.change}%` : 'N/A',
      trend: metrics.vo2Max.trend,
      color: metrics.vo2Max.trend === 'up' ? 'text-green-400' : 'text-blue-400'
    },
    {
      title: 'Frequência Cardíaca',
      value: metrics.heartRate.average.toString(),
      unit: 'bpm médio',
      change: `${metrics.heartRate.trend === 'down' ? '-' : '+'}${metrics.heartRate.change}%`,
      trend: metrics.heartRate.trend,
      color: metrics.heartRate.trend === 'down' ? 'text-green-400' : 'text-blue-400'
    },
    {
      title: 'Zona de Treino',
      value: metrics.trainingZone.currentZone,
      unit: 'zona ótima',
      change: `${metrics.trainingZone.percentage}%`,
      trend: metrics.trainingZone.trend,
      color: 'text-purple-400'
    },
    {
      title: 'Recuperação',
      value: `${metrics.recovery.level}%`,
      unit: 'nível atual',
      change: `+${metrics.recovery.change}%`,
      trend: metrics.recovery.trend,
      color: 'text-green-400'
    }
  ] : [];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Header */}
          <ScrollReveal>
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2">
                Dashboard <span className="bg-gradient-primary bg-clip-text text-transparent">Performance</span>
              </h1>
              <p className="text-muted-foreground">
                Visão geral da sua evolução atlética e insights inteligentes
              </p>
            </div>
          </ScrollReveal>

          {/* Alerts */}
          <ScrollReveal delay={100}>
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {alerts.map((alert, index) => {
                const IconComponent = alert.type === 'warning' ? AlertTriangle : 
                                    alert.type === 'success' ? TrendingUp : 
                                    Activity;
                
                return (
                  <Card key={index} className="glass-card border-glass-border">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-full ${
                          alert.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                          alert.type === 'success' ? 'bg-green-500/20 text-green-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold">{alert.title}</h3>
                            <Badge variant={alert.priority === 'high' ? 'destructive' : 'secondary'}>
                              {alert.priority === 'high' ? 'Alta' : alert.priority === 'medium' ? 'Média' : 'Baixa'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{alert.message}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollReveal>

          {/* Main Metrics */}
          <ScrollReveal delay={200}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {formattedMetrics.map((metric, index) => (
                <Card key={index} className="glass-card border-glass-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">{metric.title}</span>
                      {metric.trend === 'up' ? (
                        <TrendingUp className="h-4 w-4 text-green-400" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-blue-400" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">{metric.value}</div>
                      <div className="text-xs text-muted-foreground">{metric.unit}</div>
                      <div className={`text-sm font-medium ${metric.color}`}>
                        {metric.change} este mês
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollReveal>

          {/* Charts Section */}
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {/* Weekly Evolution */}
            <ScrollReveal delay={300}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <span>Evolução Semanal</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {weeklyData.map((day, index) => (
                      <div key={index} className="flex items-center space-x-4">
                        <div className="w-8 text-sm text-muted-foreground">{day.day}</div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-2">
                            <div className="text-xs text-muted-foreground w-16">Treino</div>
                            <div className="flex-1 bg-muted/20 rounded-full h-2">
                              <div 
                                className="bg-gradient-primary h-2 rounded-full transition-all duration-500"
                                style={{ width: `${day.training}%` }}
                              />
                            </div>
                            <div className="text-xs w-8">{day.training}%</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="text-xs text-muted-foreground w-16">Recup.</div>
                            <div className="flex-1 bg-muted/20 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${day.recovery}%` }}
                              />
                            </div>
                            <div className="text-xs w-8">{day.recovery}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>

            {/* Peak Performance Indicator */}
            <ScrollReveal delay={400}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-primary" />
                    <span>Pico de Performance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-4">
                    <div className="relative w-32 h-32 mx-auto">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="hsl(var(--muted))"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="hsl(var(--primary))"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={`${2 * Math.PI * 56 * ((peakPerformance?.current || 0) / 100)} ${2 * Math.PI * 56}`}
                          className="data-glow"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{peakPerformance?.current || 0}%</div>
                          <div className="text-xs text-muted-foreground">Atual</div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        Previsão de pico: <span className="text-primary font-medium">
                          {peakPerformance?.prediction || 'Calculando...'}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Potencial máximo: <span className="text-primary font-medium">
                          {peakPerformance?.potential || 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>

          {/* Recent Workouts */}
          <ScrollReveal delay={500}>
            <Card className="glass-card border-glass-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <span>Treinos Recentes</span>
                  </CardTitle>
                  <Button variant="outline" size="sm" className="glass-card border-glass-border">
                    Ver Todos
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivities.map((workout, index) => (
                    <div key={index} className="flex items-center space-x-4 p-4 glass-card rounded-lg">
                      <div className={`w-3 h-12 rounded-full ${workout.color}`} />
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="font-medium">{workout.type}</div>
                          <div className="text-sm text-muted-foreground">{workout.date}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Duração</div>
                          <div className="font-medium">{workout.duration}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Distância</div>
                          <div className="font-medium">{workout.distance}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Pace Médio</div>
                          <div className="font-medium">{workout.avgPace}</div>
                        </div>
                      </div>
                      <Badge variant={
                        workout.performance === 'Excelente' ? 'default' :
                        workout.performance === 'Bom' ? 'secondary' : 'outline'
                      }>
                        {workout.performance}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
};