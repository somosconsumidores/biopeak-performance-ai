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
  Loader2,
  PieChart as PieChartIcon,
  ShieldAlert,
  Info
} from 'lucide-react';

export const Dashboard = () => {
  const { 
    metrics, 
    activityDistribution, 
    alerts, 
    recentActivities, 
    peakPerformance, 
    overtrainingRisk,
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

          {/* Overtraining Risk Analysis */}
          {overtrainingRisk && (
            <ScrollReveal delay={150}>
              <Card className="glass-card border-glass-border mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ShieldAlert className="h-5 w-5 text-primary" />
                    <span>Análise de Risco de Overtraining</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Risk Level Indicator */}
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
                            stroke={
                              overtrainingRisk.level === 'alto' ? '#ef4444' :
                              overtrainingRisk.level === 'medio' ? '#f59e0b' :
                              '#10b981'
                            }
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={`${2 * Math.PI * 56 * (overtrainingRisk.score / 100)} ${2 * Math.PI * 56}`}
                            className="transition-all duration-500"
                            style={{
                              filter: `drop-shadow(0 0 4px ${
                                overtrainingRisk.level === 'alto' ? '#ef4444' :
                                overtrainingRisk.level === 'medio' ? '#f59e0b' :
                                '#10b981'
                              }30)`
                            }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-2xl font-bold">{overtrainingRisk.score}</div>
                            <div className="text-xs text-muted-foreground">Score</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className={`text-lg font-semibold capitalize ${
                          overtrainingRisk.level === 'alto' ? 'text-red-400' :
                          overtrainingRisk.level === 'medio' ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          Risco {overtrainingRisk.level}
                        </div>
                        <Badge 
                          variant={
                            overtrainingRisk.level === 'alto' ? 'destructive' :
                            overtrainingRisk.level === 'medio' ? 'outline' : 'secondary'
                          }
                          className="text-xs"
                        >
                          {overtrainingRisk.level === 'alto' ? 'Atenção Necessária' :
                           overtrainingRisk.level === 'medio' ? 'Monitorar' : 'Seguro'}
                        </Badge>
                      </div>
                    </div>

                    {/* Factors and Recommendations */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center space-x-2">
                          <Info className="h-4 w-4" />
                          <span>Fatores Identificados</span>
                        </h4>
                        <div className="space-y-2">
                          {overtrainingRisk.factors.map((factor, index) => (
                            <div key={index} className="flex items-start space-x-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">{factor}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-muted/20 border border-muted">
                        <h4 className="font-semibold mb-2 text-primary">Recomendação</h4>
                        <p className="text-sm text-muted-foreground">{overtrainingRisk.recommendation}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          )}

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
            {/* Activity Distribution */}
            <ScrollReveal delay={300}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PieChartIcon className="h-5 w-5 text-primary" />
                    <span>Distribuição dos Treinos</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activityDistribution.length > 0 ? (
                    <div className="text-center space-y-4">
                      <div className="relative w-32 h-32 mx-auto">
                        <svg className="w-32 h-32 transform -rotate-90">
                          {/* Background circle */}
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="hsl(var(--muted))"
                            strokeWidth="8"
                            fill="transparent"
                          />
                          
                          {/* Activity segments */}
                          {activityDistribution.map((activity, index) => {
                            const prevPercentage = activityDistribution
                              .slice(0, index)
                              .reduce((sum, act) => sum + act.percentage, 0);
                            const currentPercentage = activity.percentage;
                            const circumference = 2 * Math.PI * 56;
                            const strokeDasharray = `${(currentPercentage / 100) * circumference} ${circumference}`;
                            const strokeDashoffset = -((prevPercentage / 100) * circumference);
                            
                            return (
                              <circle
                                key={index}
                                cx="64"
                                cy="64"
                                r="56"
                                stroke={activity.color}
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                className="transition-all duration-500"
                                style={{
                                  filter: 'drop-shadow(0 0 4px rgba(var(--primary-rgb), 0.3))'
                                }}
                              />
                            );
                          })}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-2xl font-bold">{activityDistribution.length}</div>
                            <div className="text-xs text-muted-foreground">Tipos</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Legend */}
                      <div className="space-y-2">
                        {activityDistribution.slice(0, 3).map((activity, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: activity.color }}
                              />
                              <span className="text-muted-foreground">{activity.name}</span>
                            </div>
                            <span className="font-medium">{activity.percentage}%</span>
                          </div>
                        ))}
                        {activityDistribution.length > 3 && (
                          <div className="text-xs text-muted-foreground text-center pt-1">
                            +{activityDistribution.length - 3} outros tipos
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <PieChartIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma atividade encontrada</p>
                      </div>
                    </div>
                  )}
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