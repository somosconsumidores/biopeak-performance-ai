import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { CommitmentsCard } from '@/components/CommitmentsCard';
import { BioPeakFitnessCard } from '@/components/BioPeakFitnessCard';
import { AchievementSection } from '@/components/AchievementSection';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useGarminVo2Max } from '@/hooks/useGarminVo2Max';
import { useAuth } from '@/hooks/useAuth';
import { useScreenSize } from '@/hooks/use-mobile';
import { useAchievementSystem } from '@/hooks/useAchievementSystem';
import { SleepAnalysisDialog } from '@/components/SleepAnalysisDialog';
import { useTranslation } from '@/hooks/useTranslation';

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
  Info,
  Moon,
  Brain,
  Sparkles,
  TrendingUp as TrendingUpIcon,
  Trophy,
  Target as TargetIcon
} from 'lucide-react';

export const Dashboard = () => {
  const [filters, setFilters] = useState({ period: '30d', activityType: 'all' });
  const [activeSection, setActiveSection] = useState('fitness-score');
  const { 
    metrics, 
    activityDistribution, 
    alerts, 
    recentActivities, 
    peakPerformance, 
    overtrainingRisk,
    sleepAnalytics,
    loading, 
    error 
  } = useDashboardMetrics();
  
  const {
    currentVo2Max,
    change: vo2Change,
    trend: vo2Trend,
    lastRecordDate,
    loading: vo2Loading,
    error: vo2Error
  } = useGarminVo2Max();

  const { checkAchievements } = useAchievementSystem();
  
  console.log('🔍 DASHBOARD VO2MAX DEBUG:', { 
    currentVo2Max, 
    vo2Change, 
    vo2Trend, 
    lastRecordDate, 
    vo2Loading, 
    vo2Error 
  });
  
  const { user } = useAuth();
  const { isMobile, isTablet } = useScreenSize();
  const { t } = useTranslation();

  // Verificar conquistas quando o dashboard carrega
  useEffect(() => {
    if (user) {
      checkAchievements();
    }
  }, [user, checkAchievements]);

  // Get sleep and overtraining data for AI analysis
  const getSleepAnalysisData = () => {
    if (!sleepAnalytics || !overtrainingRisk) return null;

    const totalSleepMinutes = sleepAnalytics.totalSleepMinutes || 0;
    
    const sleepData = {
      sleepScore: sleepAnalytics.sleepScore || 0,
      totalSleep: totalSleepMinutes,
      lightSleep: Math.round((sleepAnalytics.lightSleepPercentage / 100) * totalSleepMinutes),
      deepSleep: Math.round((sleepAnalytics.deepSleepPercentage / 100) * totalSleepMinutes),
      remSleep: Math.round((sleepAnalytics.remSleepPercentage / 100) * totalSleepMinutes),
    };

    const overtrainingAnalysisData = {
      score: overtrainingRisk.score,
      level: overtrainingRisk.level,
      factors: overtrainingRisk.factors,
    };

    return { sleepData, overtrainingData: overtrainingAnalysisData };
  };

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
      title: 'VO₂ Max - Calculado e informado pela Garmin',
      value: !vo2Loading && currentVo2Max ? currentVo2Max.toString() : 'Não informado',
      unit: 'ml/kg/min',
      change: !vo2Loading && currentVo2Max && vo2Change !== 0 ? 
        `${vo2Change > 0 ? '+' : ''}${vo2Change.toFixed(1)}%` : 
        '',
      trend: vo2Trend || 'stable',
      color: vo2Trend === 'up' ? 'text-green-400' : vo2Trend === 'down' ? 'text-red-400' : 'text-blue-400',
      source: lastRecordDate ? `Último registro: ${lastRecordDate}` : undefined,
      icon: Zap
    },
    {
      title: 'Frequência Cardíaca',
      value: metrics.heartRate.average.toString(),
      unit: 'bpm médio',
      change: `${metrics.heartRate.trend === 'down' ? '-' : '+'}${metrics.heartRate.change}%`,
      trend: metrics.heartRate.trend,
      color: metrics.heartRate.trend === 'down' ? 'text-green-400' : 'text-blue-400',
      icon: Heart
    },
    {
      title: 'Recuperação',
      value: `${metrics.recovery.level}%`,
      unit: 'nível atual',
      change: `+${metrics.recovery.change}%`,
      trend: metrics.recovery.trend,
      color: 'text-green-400',
      icon: Award
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

          {/* Section Toggle */}
          <ScrollReveal delay={120}>
            <div className="mb-6 md:mb-8">
              <div className="grid grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                {[
                  {
                    id: 'fitness-score',
                    icon: TrendingUpIcon,
                    title: 'BioPeak Fitness',
                    subtitle: 'Score',
                    gradient: 'from-emerald-500 to-teal-500'
                  },
                  {
                    id: 'overtraining-risk',
                    icon: ShieldAlert,
                    title: 'Risco de',
                    subtitle: 'Overtraining',
                    gradient: 'from-amber-500 to-orange-500'
                  },
                  {
                    id: 'commitments',
                    icon: TargetIcon,
                    title: 'Compromissos',
                    subtitle: 'de Melhoria',
                    gradient: 'from-blue-500 to-indigo-500'
                  },
                  {
                    id: 'achievements',
                    icon: Trophy,
                    title: 'Suas',
                    subtitle: 'Conquistas',
                    gradient: 'from-purple-500 to-pink-500'
                  }
                ].map((section) => {
                  const IconComponent = section.icon;
                  const isActive = activeSection === section.id;
                  
                  return (
                    <div 
                      key={section.id}
                      className={`
                        cursor-pointer transition-all duration-300 hover:scale-105 group
                        ${isActive ? 'scale-105' : ''}
                      `}
                      onClick={() => setActiveSection(section.id)}
                    >
                      <div className="relative">
                        {/* Mobile App Icon */}
                        <div className={`
                          relative w-full aspect-square rounded-3xl p-1 transition-all duration-300
                          ${isActive 
                            ? 'bg-gradient-to-br ' + section.gradient + ' shadow-2xl ring-2 ring-white/30' 
                            : 'bg-gradient-to-br from-muted/60 to-muted/40 hover:from-muted/80 hover:to-muted/60'
                          }
                        `}>
                          <div className={`
                            w-full h-full rounded-[20px] flex items-center justify-center transition-all duration-300
                            ${isActive 
                              ? 'bg-white/10 backdrop-blur-sm' 
                              : 'bg-white/5 group-hover:bg-white/10'
                            }
                          `}>
                            <IconComponent className={`
                              h-6 w-6 sm:h-7 sm:w-7 md:h-6 md:w-6 lg:h-7 lg:w-7 transition-all duration-300
                              ${isActive ? 'text-white scale-110' : 'text-muted-foreground group-hover:text-foreground'}
                            `} />
                          </div>
                        </div>
                        
                        {/* Active Indicator */}
                        {isActive && (
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow-lg animate-pulse" />
                        )}
                      </div>
                      
                      {/* Text Label */}
                      <div className="mt-3 text-center">
                        <div className={`
                          text-xs sm:text-sm font-medium leading-tight transition-colors duration-300
                          ${isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}
                        `}>
                          {section.title}
                        </div>
                        <div className={`
                          text-xs leading-tight transition-colors duration-300
                          ${isActive ? 'text-muted-foreground' : 'text-muted-foreground/80'}
                        `}>
                          {section.subtitle}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>

          {/* Dynamic Section Content */}
          <ScrollReveal delay={140}>
            <div className="mb-6 md:mb-8">
              {activeSection === 'fitness-score' && <BioPeakFitnessCard />}
              
              {activeSection === 'overtraining-risk' && overtrainingRisk && (
                <Card className="glass-card border-glass-border">
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
              )}

              {activeSection === 'commitments' && <CommitmentsCard />}
              
              {activeSection === 'achievements' && <AchievementSection maxItems={6} />}
            </div>
          </ScrollReveal>

          {/* Main Metrics */}
          <ScrollReveal delay={200}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 mb-6 md:mb-8">
              {formattedMetrics.map((metric, index) => {
                const IconComponent = metric.icon || (metric.trend === 'up' ? TrendingUp : TrendingDown);
                return (
                  <Card key={index} className="glass-card border-glass-border hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                    <CardContent className="p-5 sm:p-6">
                      {/* Header with Icon */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-muted-foreground leading-relaxed mb-1">
                            {metric.title}
                          </h3>
                          {metric.source && (
                            <div className="text-xs text-muted-foreground/70 leading-relaxed">
                              {metric.source}
                            </div>
                          )}
                        </div>
                        <div className={`
                          p-2.5 rounded-2xl transition-all duration-300
                          ${metric.trend === 'up' ? 'bg-emerald-500/10 text-emerald-500' : 
                            metric.trend === 'down' ? 'bg-red-500/10 text-red-500' : 
                            'bg-blue-500/10 text-blue-500'}
                        `}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                      </div>
                      
                      {/* Main Value */}
                      <div className="space-y-2 mb-4">
                        <div className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                          {metric.value}
                        </div>
                        <div className="text-sm text-muted-foreground font-medium">
                          {metric.unit}
                        </div>
                      </div>
                      
                      {/* Change Indicator */}
                      {metric.change && (
                        <div className="flex items-center space-x-2">
                          <div className={`
                            px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                            ${metric.trend === 'up' ? 'bg-emerald-500/10 text-emerald-500' : 
                              metric.trend === 'down' ? 'bg-red-500/10 text-red-500' : 
                              'bg-blue-500/10 text-blue-500'}
                          `}>
                            {metric.change}
                          </div>
                          <span className="text-xs text-muted-foreground">este mês</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
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

          {/* Sleep Analytics */}
          {sleepAnalytics && (
            <ScrollReveal delay={450}>
              <Card className="glass-card border-glass-border mb-6 md:mb-8">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-primary" />
                      <h3 className="text-lg font-semibold">Análise do Sono</h3>
                    </div>
                    {(() => {
                      const analysisData = getSleepAnalysisData();
                      return analysisData ? (
                        <SleepAnalysisDialog 
                          sleepData={analysisData.sleepData}
                          overtrainingData={analysisData.overtrainingData}
                        />
                      ) : null;
                    })()}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Sleep Score & Duration */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-3xl font-bold text-foreground">
                            {sleepAnalytics.sleepScore || 'N/A'}
                          </div>
                          <div className="text-sm text-muted-foreground">Score de Sono</div>
                          <div className="text-xs text-muted-foreground">
                            {sleepAnalytics.lastSleepDate ? `Última noite: ${sleepAnalytics.lastSleepDate}` : 'Sem dados recentes'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {sleepAnalytics.hoursSlept || 'N/A'}
                          </div>
                          <div className="text-sm text-muted-foreground">Tempo Dormido</div>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-muted/20 border border-muted">
                        <h4 className="font-semibold mb-2 text-primary flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <span>Qualidade do Sono</span>
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {sleepAnalytics.qualityComment}
                        </p>
                      </div>
                    </div>

                    {/* Sleep Stages Distribution */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground flex items-center space-x-2">
                        <Brain className="h-4 w-4" />
                        <span>Distribuição das Fases do Sono</span>
                      </h4>
                      
                      <div className="space-y-3">
                        {/* Deep Sleep */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Sono Profundo</span>
                            <span className="text-sm font-medium text-foreground">{sleepAnalytics.deepSleepPercentage}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${sleepAnalytics.deepSleepPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Light Sleep */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Sono Leve</span>
                            <span className="text-sm font-medium text-foreground">{sleepAnalytics.lightSleepPercentage}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-cyan-400 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${sleepAnalytics.lightSleepPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* REM Sleep */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Sono REM</span>
                            <span className="text-sm font-medium text-foreground">{sleepAnalytics.remSleepPercentage}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${sleepAnalytics.remSleepPercentage}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center pt-2">
                        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <div className="text-xs text-blue-400 font-medium">Profundo</div>
                          <div className="text-xs text-muted-foreground">Recuperação</div>
                        </div>
                        <div className="p-2 rounded-lg bg-cyan-400/10 border border-cyan-400/20">
                          <div className="text-xs text-cyan-400 font-medium">Leve</div>
                          <div className="text-xs text-muted-foreground">Transição</div>
                        </div>
                        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <div className="text-xs text-purple-400 font-medium">REM</div>
                          <div className="text-xs text-muted-foreground">Memória</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          )}

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

                      const activityColor = getActivityColor(activity.type);
                      const performanceBadge = activity.performance;

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
