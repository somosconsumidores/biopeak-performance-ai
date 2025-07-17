import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { CommitmentsCard } from '@/components/CommitmentsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useScreenSize } from '@/hooks/use-mobile';

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
  
  const { isMobile, isTablet } = useScreenSize();

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
      
      <div className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Header */}
          <ScrollReveal>
            <div className="mb-6 md:mb-8">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                Dashboard <span className="bg-gradient-primary bg-clip-text text-transparent">Performance</span>
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Visão geral da sua evolução atlética e insights inteligentes
              </p>
            </div>
          </ScrollReveal>

          {/* Alerts */}
          <ScrollReveal delay={100}>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 mb-6 md:mb-8">
              {alerts.map((alert, index) => {
                const IconComponent = alert.type === 'warning' ? AlertTriangle : 
                                    alert.type === 'success' ? TrendingUp : 
                                    Activity;
                
                return (
                  <Card key={index} className="glass-card border-glass-border">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start space-x-2 sm:space-x-3">
                        <div className={`p-1.5 sm:p-2 rounded-full flex-shrink-0 ${
                          alert.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                          alert.type === 'success' ? 'bg-green-500/20 text-green-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          <IconComponent className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1 gap-2">
                            <h3 className="font-semibold text-sm sm:text-base leading-tight">{alert.title}</h3>
                            <Badge 
                              variant={alert.priority === 'high' ? 'destructive' : 'secondary'}
                              className="text-xs flex-shrink-0"
                            >
                              {alert.priority === 'high' ? 'Alta' : alert.priority === 'medium' ? 'Média' : 'Baixa'}
                            </Badge>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{alert.message}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollReveal>

          {/* Commitments Section */}
          <ScrollReveal delay={150}>
            <div className="mb-6 md:mb-8">
              <CommitmentsCard />
            </div>
          </ScrollReveal>

          {/* Overtraining Risk Analysis */}
          {overtrainingRisk && (
            <ScrollReveal delay={175}>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 md:mb-8">
              {formattedMetrics.map((metric, index) => (
                <Card key={index} className="glass-card border-glass-border">
                  <CardContent className="p-3 sm:p-4 md:p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs sm:text-sm text-muted-foreground truncate pr-1">{metric.title}</span>
                      {metric.trend === 'up' ? (
                        <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                      ) : (
                        <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-lg sm:text-xl md:text-2xl font-bold leading-tight">{metric.value}</div>
                      <div className="text-xs text-muted-foreground">{metric.unit}</div>
                      <div className={`text-xs sm:text-sm font-medium ${metric.color}`}>
                        {metric.change} este mês
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollReveal>

          {/* Charts Section */}
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 mb-6 md:mb-8">
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
                       <div className={`relative mx-auto ${isMobile ? 'w-24 h-24' : 'w-32 h-32'}`}>
                         <svg className={`${isMobile ? 'w-24 h-24' : 'w-32 h-32'} transform -rotate-90`}>
                           {/* Background circle */}
                           <circle
                             cx={isMobile ? "48" : "64"}
                             cy={isMobile ? "48" : "64"}
                             r={isMobile ? "40" : "56"}
                             stroke="hsl(var(--muted))"
                             strokeWidth={isMobile ? "6" : "8"}
                             fill="transparent"
                           />
                           
                           {/* Activity segments */}
                           {activityDistribution.map((activity, index) => {
                             const prevPercentage = activityDistribution
                               .slice(0, index)
                               .reduce((sum, act) => sum + act.percentage, 0);
                             const currentPercentage = activity.percentage;
                             const radius = isMobile ? 40 : 56;
                             const circumference = 2 * Math.PI * radius;
                             const strokeDasharray = `${(currentPercentage / 100) * circumference} ${circumference}`;
                             const strokeDashoffset = -((prevPercentage / 100) * circumference);
                             
                             return (
                               <circle
                                 key={index}
                                 cx={isMobile ? "48" : "64"}
                                 cy={isMobile ? "48" : "64"}
                                 r={radius}
                                 stroke={activity.color}
                                 strokeWidth={isMobile ? "6" : "8"}
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
                             <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{activityDistribution.length}</div>
                             <div className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-xs'}`}>Tipos</div>
                           </div>
                         </div>
                       </div>
                      
                       {/* Legend */}
                       <div className={`space-y-2 ${isMobile ? 'space-y-1' : 'space-y-2'}`}>
                         {activityDistribution.slice(0, 3).map((activity, index) => (
                           <div key={index} className={`flex items-center justify-between ${isMobile ? 'text-xs' : 'text-sm'}`}>
                             <div className="flex items-center space-x-2">
                               <div 
                                 className={`rounded-full ${isMobile ? 'w-2 h-2' : 'w-3 h-3'}`}
                                 style={{ backgroundColor: activity.color }}
                               />
                               <span className="text-muted-foreground truncate">{activity.name}</span>
                             </div>
                             <span className="font-medium flex-shrink-0">{activity.percentage}%</span>
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
                  <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    <span>Treinos Recentes</span>
                  </CardTitle>
                  {recentActivities.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Ver Todos
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                {recentActivities.length > 0 ? (
                  <div className="space-y-3">
                    {recentActivities.slice(0, 5).map((activity, index) => {
                      // Define colors for different activity types
                      const getActivityColor = (type: string) => {
                        const typeMap: { [key: string]: string } = {
                          'RUNNING': '#10b981',
                          'CYCLING': '#3b82f6', 
                          'SWIMMING': '#06b6d4',
                          'OPEN_WATER_SWIMMING': '#06b6d4',
                          'WALKING': '#84cc16',
                          'HIKING': '#eab308',
                          'default': '#8b5cf6'
                        };
                        return typeMap[type.toUpperCase()] || typeMap.default;
                      };

                      // Get performance badge  
                      const getPerformanceBadge = () => {
                        const badges = ['Excelente', 'Bom', 'Regular', 'Moderado'];
                        return badges[Math.floor(Math.random() * badges.length)];
                      };

                      const activityColor = getActivityColor(activity.type);
                      const performanceBadge = getPerformanceBadge();

                      return (
                        <div 
                          key={index} 
                          className="relative p-3 sm:p-4 glass-card rounded-lg border-l-4 overflow-hidden"
                          style={{ borderLeftColor: activityColor }}
                        >
                          {/* Activity header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm sm:text-base text-foreground mb-1 truncate">
                                {activity.type.replace(/_/g, ' ')}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {activity.date}
                              </p>
                            </div>
                            <Badge 
                              variant="secondary" 
                              className="ml-2 text-xs font-medium flex-shrink-0"
                              style={{ 
                                backgroundColor: `${activityColor}20`,
                                color: activityColor,
                                border: `1px solid ${activityColor}40`
                              }}
                            >
                              {performanceBadge}
                            </Badge>
                          </div>

                          {/* Activity stats */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Distância</p>
                              <p className="text-sm sm:text-base font-semibold text-foreground">
                                {activity.distance || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                {activity.type.includes('SWIMMING') ? 'Pace Médio' : 'Duração'}
                              </p>
                              <p className="text-sm sm:text-base font-semibold text-foreground">
                                {activity.duration}
                              </p>
                            </div>
                          </div>

                          {/* Activity type indicator bar */}
                          <div 
                            className="absolute top-3 left-0 w-1 h-8 rounded-r-full opacity-80"
                            style={{ backgroundColor: activityColor }}
                          >
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-48 sm:h-64 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Activity className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma atividade recente</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sincronize suas atividades do Garmin para ver os dados
                      </p>
                    </div>
                   </div>
                 )}
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
};