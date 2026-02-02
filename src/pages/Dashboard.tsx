import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { CommitmentsCard } from '@/components/CommitmentsCard';
import { BioPeakFitnessCard } from '@/components/BioPeakFitnessCard';
import { AthleteSegmentationCard } from '@/components/AthleteSegmentationCard';
import { AchievementSection } from '@/components/AchievementSection';
import { TrainingAgendaWidget } from '@/components/TrainingAgendaWidget';
import { RaceCalendar } from '@/components/RaceCalendar';
import { TodayTrainingAlert } from '@/components/TodayTrainingAlert';
import { CoachInsightsCarousel } from '@/components/CoachInsightsCarousel';
import { CoachAdviceCard } from '@/components/CoachAdviceCard';
import { useRaceStrategies } from '@/hooks/useRaceStrategies';
import { useInsights } from '@/hooks/useInsights';
import { useCommitments } from '@/hooks/useCommitments';
import TrainingRecommendationsCard from '@/components/TrainingRecommendationsCard';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useGarminVo2Max } from '@/hooks/useGarminVo2Max';
import { useDanielsVo2Max } from '@/hooks/useDanielsVo2Max';
import { useAuth } from '@/hooks/useAuth';
import { useScreenSize } from '@/hooks/use-mobile';
import { useAchievementSystem } from '@/hooks/useAchievementSystem';
import { SleepAnalysisDialog } from '@/components/SleepAnalysisDialog';
import { useTranslation } from '@/hooks/useTranslation';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { PremiumBlur } from '@/components/PremiumBlur';
import { PremiumButton } from '@/components/PremiumButton';
import { usePlatform } from '@/hooks/usePlatform';

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
  Target as TargetIcon,
  Lightbulb,
  Star,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Apple
} from 'lucide-react';
import { NutritionWeeklyPlan } from '@/components/nutrition/NutritionWeeklyPlan';
import { Progress } from '@/components/ui/progress';

export const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [filters, setFilters] = useState({ period: '30d', activityType: 'all' });
  
  // Read section from URL params (for native app navigation to nutrition)
  const sectionFromUrl = searchParams.get('section');
  const [activeSection, setActiveSection] = useState(sectionFromUrl || 'fitness-score');
  
  // Update activeSection when URL param changes
  useEffect(() => {
    if (sectionFromUrl) {
      setActiveSection(sectionFromUrl);
    }
  }, [sectionFromUrl]);
  
  const [hasStrategies, setHasStrategies] = useState(false);
  const { loadStrategies } = useRaceStrategies();
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
    currentVo2Max: garminVo2Max,
    change: vo2Change,
    trend: vo2Trend,
    lastRecordDate,
    loading: vo2Loading,
    error: vo2Error
  } = useGarminVo2Max();

  const {
    currentVo2Max: danielsVo2Max,
    trend: danielsTrend,
    change: danielsChange,
    loading: danielsLoading
  } = useDanielsVo2Max();

  // Use Garmin VO2 Max if available, otherwise fall back to Daniels
  const currentVo2Max = garminVo2Max || danielsVo2Max;
  const vo2Source = garminVo2Max ? 'Garmin' : (danielsVo2Max ? 'Daniels' : null);
  const finalVo2Trend = garminVo2Max ? vo2Trend : danielsTrend;
  const finalVo2Change = garminVo2Max ? vo2Change : danielsChange;

  const { checkAchievements } = useAchievementSystem();
  const { user } = useAuth();
  const { isMobile, isTablet } = useScreenSize();
  const { t } = useTranslation();
  const { isSubscribed, loading: subscriptionLoading } = useSubscription();
  const { insights, loading: insightsLoading, error: insightsError, refreshInsights } = useInsights();
  const { applyRecommendation } = useCommitments();
  const { isNative } = usePlatform();

  // Verificar conquistas quando o dashboard carrega
  useEffect(() => {
    if (user) {
      checkAchievements();
    }
  }, [user, checkAchievements]);

  // Check if user has saved strategies
  useEffect(() => {
    const checkStrategies = async () => {
      const strategies = await loadStrategies();
      setHasStrategies(strategies.length > 0);
    };
    
    if (user) {
      checkStrategies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle successful subscription
  useEffect(() => {
    const subscriptionSuccess = searchParams.get('subscription');
    if (subscriptionSuccess === 'success') {
      toast({
        title: "🎉 Assinatura Ativada!",
        description: "Bem-vindo ao BioPeak Premium! Todas as funcionalidades foram liberadas.",
      });
      // Remove the parameter from URL
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('subscription');
        return newParams;
      });
    }
  }, [searchParams, setSearchParams, toast]);

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

  // Timeout fallback for subscription loading (prevent infinite loading on native apps)
  const [subscriptionTimeout, setSubscriptionTimeout] = useState(false);
  
  useEffect(() => {
    if (subscriptionLoading && !subscriptionTimeout) {
      const timeout = setTimeout(() => {
        console.warn('[Dashboard] Subscription loading timeout reached');
        setSubscriptionTimeout(true);
      }, 10000); // 10 seconds max wait
      return () => clearTimeout(timeout);
    }
    if (!subscriptionLoading) {
      setSubscriptionTimeout(false);
    }
  }, [subscriptionLoading, subscriptionTimeout]);

  // Show loading only for subscription check, with timeout fallback
  if (subscriptionLoading && !subscriptionTimeout) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        {isNative && <Header />}
        <div className={`pb-12 px-4 sm:px-6 lg:px-8 ${isNative ? 'pt-24' : 'pt-8'}`}>
          <div className="container mx-auto">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Verificando assinatura...</p>
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
        {isNative && <Header />}
        <div className={`pb-12 px-4 sm:px-6 lg:px-8 ${isNative ? 'pt-24' : 'pt-8'}`}>
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
      title: vo2Source ? `VO₂ Max - ${vo2Source}` : 'VO₂ Max',
      value: !vo2Loading && !danielsLoading && currentVo2Max ? currentVo2Max.toFixed(1) : 'Não informado',
      unit: 'ml/kg/min',
      change: !vo2Loading && !danielsLoading && currentVo2Max && finalVo2Change !== 0 ? 
        `${finalVo2Change > 0 ? '+' : ''}${Math.abs(finalVo2Change).toFixed(1)}${garminVo2Max ? '%' : ' ml/kg/min'}` : 
        '',
      trend: finalVo2Trend || 'stable',
      color: finalVo2Trend === 'up' ? 'text-green-400' : finalVo2Trend === 'down' ? 'text-red-400' : 'text-blue-400',
      source: vo2Source === 'Garmin' && lastRecordDate ? `Último registro: ${lastRecordDate}` : 
              vo2Source === 'Daniels' ? 'Calculado pela fórmula de Jack Daniels' : undefined,
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
      {isNative && <Header />}
      
      <div className={`pb-8 sm:pb-12 px-3 sm:px-4 md:px-6 lg:px-8 ${isNative ? 'safe-pt-20 sm:safe-pt-24' : 'pt-6'}`}>
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

          {/* Today Training Alert */}
          <ScrollReveal delay={10}>
            <div className="mb-6 md:mb-8">
              <TodayTrainingAlert />
            </div>
          </ScrollReveal>

          {/* Athlete Profile - Top of Dashboard */}
          <ScrollReveal delay={11}>
            <div className="mb-6 md:mb-8">
              <AthleteSegmentationCard />
            </div>
          </ScrollReveal>

          {/* Coach Advice Card */}
          <ScrollReveal delay={12}>
            <div className="mb-4 md:mb-6">
              <CoachAdviceCard />
            </div>
          </ScrollReveal>

          {/* Coach Insights Carousel */}
          <ScrollReveal delay={15}>
            <div className="mb-6 md:mb-8">
              <CoachInsightsCarousel />
            </div>
          </ScrollReveal>

          {/* Section Toggle */}
          <ScrollReveal delay={20}>
            <div className="mb-6 md:mb-8">
              {/* Mobile: Grid layout with icons */}
              <div className="md:hidden overflow-x-auto pb-2 -mx-3 px-3">
                <div className="flex gap-2 min-w-max">
                {[
                  {
                    id: 'fitness-score',
                    icon: TrendingUpIcon,
                    title: 'Fitness',
                    subtitle: 'Score',
                    gradient: 'from-emerald-500 to-teal-500'
                  },
                  {
                    id: 'overtraining-risk',
                    icon: ShieldAlert,
                    title: 'Risco',
                    subtitle: 'Overtrain',
                    gradient: 'from-amber-500 to-orange-500'
                  },
                  {
                    id: 'training-plan',
                    icon: TargetIcon,
                    title: 'Plano',
                    subtitle: 'Treino',
                    gradient: 'from-blue-500 to-indigo-500'
                  },
                  {
                    id: 'nutrition-plan',
                    icon: Apple,
                    title: 'Plano',
                    subtitle: 'Nutricional',
                    gradient: 'from-green-500 to-emerald-500'
                  },
                  {
                    id: 'insights',
                    icon: Sparkles,
                    title: 'Insights',
                    subtitle: '',
                    gradient: 'from-purple-500 to-pink-500'
                  }
                ].map((section) => {
                  const IconComponent = section.icon;
                  const isActive = activeSection === section.id;
                  
                  return (
                    <div 
                      key={section.id}
                      className="cursor-pointer transition-all duration-300 hover:scale-105 group w-16 flex-shrink-0"
                      onClick={() => setActiveSection(section.id)}
                    >
                      <div className="relative">
                        <div className={`
                          relative w-14 h-14 rounded-2xl p-0.5 transition-all duration-300
                          ${isActive 
                            ? 'bg-gradient-to-br ' + section.gradient + ' shadow-xl ring-2 ring-white/30' 
                            : 'bg-gradient-to-br from-muted/60 to-muted/40 hover:from-muted/80 hover:to-muted/60'
                          }
                        `}>
                          <div className={`
                            w-full h-full rounded-[14px] flex items-center justify-center transition-all duration-300
                            ${isActive 
                              ? 'bg-white/10 backdrop-blur-sm' 
                              : 'bg-white/5 group-hover:bg-white/10'
                            }
                          `}>
                            <IconComponent className={`
                              h-5 w-5 transition-all duration-300
                              ${isActive ? 'text-white scale-110' : 'text-muted-foreground group-hover:text-foreground'}
                            `} />
                          </div>
                        </div>
                        
                        {isActive && (
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-lg animate-pulse" />
                        )}
                      </div>
                      
                      <div className="mt-1.5 text-center">
                        <div className={`
                          text-[10px] font-medium leading-tight transition-colors duration-300
                          ${isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}
                        `}>
                          {section.title}
                        </div>
                        <div className={`
                          text-[10px] leading-tight transition-colors duration-300
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

              {/* Desktop: Simple pill toggle */}
              <div className="hidden md:flex justify-center">
                <div className="flex gap-1 p-1 bg-muted/30 rounded-full border">
                  {[
                    { id: 'fitness-score', label: 'BioPeak Fitness Score' },
                    { id: 'overtraining-risk', label: 'Risco de Overtraining' },
                    { id: 'training-plan', label: 'Plano de Treino' },
                    { id: 'nutrition-plan', label: 'Plano Nutricional' },
                    { id: 'insights', label: 'Insights' }
                  ].map((section) => {
                    const isActive = activeSection === section.id;
                    
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`
                          px-4 py-2 text-sm font-medium rounded-full transition-all duration-200
                          ${isActive 
                            ? 'bg-primary text-primary-foreground shadow-sm' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          }
                        `}
                      >
                        {section.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Dynamic Section Content */}
          <ScrollReveal delay={40}>
            <div className="space-y-6 md:space-y-8 mb-6 md:mb-8">
              {loading && (
                <Card className="glass-card border-glass-border">
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Carregando seus dados...</p>
                      <p className="text-xs text-muted-foreground/60">Isso pode levar alguns segundos</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* BioPeak Fitness Score Section */}
              {!loading && activeSection === 'fitness-score' && (
                <>
                  {/* BioPeak Fitness Score */}
                  {isSubscribed ? (
                    <BioPeakFitnessCard />
                  ) : (
                    <PremiumBlur message="BioPeak Fitness Score é um recurso premium">
                      <BioPeakFitnessCard />
                    </PremiumBlur>
                  )}
                  
                  {/* Main Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
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

                  {/* Charts Section */}
                  <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
                    {/* Activity Distribution */}
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

                    {/* Peak Performance Indicator */}
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
                  </div>

                  {/* Sleep Analytics */}
                  {sleepAnalytics && (
                    <Card className="glass-card border-glass-border">
                       <CardHeader>
                         <div className={`flex gap-4 ${isMobile ? 'flex-col items-start' : 'items-center justify-between'}`}>
                           <div className="flex items-center gap-2">
                             <Moon className="w-4 h-4 text-primary" />
                             <h3 className="text-lg font-semibold">Análise do Sono</h3>
                           </div>
                            {(() => {
                              const analysisData = getSleepAnalysisData();
                              return analysisData ? (
                                <div className={isMobile ? 'w-full mt-2' : ''}>
                                  {isSubscribed ? (
                                    <SleepAnalysisDialog 
                                      sleepData={analysisData.sleepData}
                                      overtrainingData={analysisData.overtrainingData}
                                    />
                                  ) : (
                                    <PremiumButton>
                                      Analisar Sono com IA
                                    </PremiumButton>
                                  )}
                                </div>
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
                  )}

                  {/* Recent Workouts */}
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
                </>
              )}
              
              {/* Overtraining Risk Section */}
              {!loading && activeSection === 'overtraining-risk' && overtrainingRisk && (
                isSubscribed ? (
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
                ) : (
                  <PremiumBlur message="Análise de risco de overtraining é um recurso premium">
                    <Card className="glass-card border-glass-border">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <ShieldAlert className="h-5 w-5 text-primary" />
                          <span>Análise de Risco de Overtraining</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="text-center space-y-4">
                            <div className="relative w-32 h-32 mx-auto">
                              <div className="w-32 h-32 rounded-full bg-muted/20 flex items-center justify-center">
                                <span className="text-2xl font-bold">--</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="h-20 bg-muted/20 rounded"></div>
                            <div className="h-16 bg-muted/20 rounded"></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </PremiumBlur>
                )
              )}
              
              {/* Training Plan Section */}
              {!loading && activeSection === 'training-plan' && (
                <>
                  {/* Training Agenda Widget */}
                  <TrainingAgendaWidget />

                  {/* Race Calendar */}
                  <RaceCalendar />

                  {/* Race Planning Card */}
                  <Card className="glass-card border-glass-border">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Trophy className="h-5 w-5 text-primary" />
                        <span>Planejador de Prova</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Planeje sua estratégia de corrida com precisão. Defina seu objetivo e descubra a melhor distribuição de pace para alcançar seu melhor desempenho.
                      </p>
                      <div className={`flex ${hasStrategies ? 'flex-col sm:flex-row' : ''} gap-2`}>
                        <Link to="/race-planning" className={hasStrategies ? 'flex-1' : 'w-full'}>
                          <Button className="w-full">
                            <Trophy className="h-4 w-4 mr-2" />
                            Nova Estratégia
                          </Button>
                        </Link>
                        {hasStrategies && (
                          <Link to="/saved-strategies" className="flex-1">
                            <Button variant="outline" className="w-full">
                              Minhas Estratégias
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Nutrition Plan Section */}
              {!loading && activeSection === 'nutrition-plan' && (
                <NutritionWeeklyPlan />
              )}
              
              {/* Insights Section */}
              {!loading && activeSection === 'insights' && (
                <>
                  {insightsLoading && (
                    <Card className="glass-card border-glass-border">
                      <CardContent className="py-12">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">Gerando Insights com IA</p>
                          <p className="text-xs text-muted-foreground/60">
                            Analisando seus dados de treino dos últimos 60 dias para criar insights personalizados...
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {insightsError && (
                    <Card className="glass-card border-glass-border">
                      <CardContent className="py-12">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                          <h2 className="text-xl font-semibold mb-2">Erro ao Carregar Insights</h2>
                          <p className="text-muted-foreground text-center max-w-md mb-6">{insightsError}</p>
                          <Button onClick={refreshInsights} variant="outline">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Tentar Novamente
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {!insightsLoading && !insightsError && insights && (
                    <>
                      {/* Header with refresh button */}
                      {isSubscribed ? (
                        <>
                          <div className="flex items-center justify-between mb-6">
                            <div>
                              <h2 className="text-2xl font-bold mb-2">
                                Insights <span className="bg-gradient-primary bg-clip-text text-transparent">Personalizados</span>
                              </h2>
                              <p className="text-sm text-muted-foreground">
                                Análise inteligente da sua performance com recomendações baseadas em IA
                              </p>
                            </div>
                            <Button onClick={refreshInsights} variant="outline" size="sm">
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Atualizar
                            </Button>
                          </div>

                          {/* Weekly Insights */}
                          <div className="mb-8">
                            <h3 className="text-xl font-bold mb-4 text-foreground">Insights da Semana</h3>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {insights.weeklyInsights.map((insight, index) => (
                                <Card key={index} className="glass-card border-glass-border">
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                      <h4 className="font-semibold text-sm text-foreground">{insight.title}</h4>
                                      <Badge variant={insight.isPositive ? "default" : "destructive"} className="text-xs">
                                        {insight.change}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>

                          {/* Personalized Metrics */}
                          <div className="mb-8">
                            <h3 className="text-xl font-bold mb-4 text-foreground">Métricas Personalizadas</h3>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {insights.personalizedMetrics.map((metric, index) => (
                                <Card key={index} className="glass-card border-glass-border">
                                  <CardContent className="p-4 text-center">
                                    <div className="flex items-center justify-center mb-2">
                                      <Heart className="h-5 w-5 mr-2 text-primary" />
                                      <span className="text-sm text-muted-foreground">{metric.label}</span>
                                    </div>
                                    <div className="text-2xl font-bold text-foreground mb-1">
                                      {metric.value}
                                      <span className="text-sm text-muted-foreground ml-1">{metric.unit}</span>
                                    </div>
                                    <Badge variant={metric.isPositive ? "default" : "secondary"} className="text-xs">
                                      {metric.change}
                                    </Badge>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>

                          {/* Zone Effectiveness */}
                          <div className="mb-8">
                            <h3 className="text-xl font-bold mb-4 text-foreground">Efetividade por Zona</h3>
                            <Card className="glass-card border-glass-border">
                              <CardContent className="p-4">
                                <div className="space-y-4">
                                  {insights.zoneEffectiveness.map((zone, index) => (
                                    <div key={index} className="flex items-center justify-between">
                                      <span className="text-sm font-medium text-foreground">{zone.zone}</span>
                                      <div className="flex items-center gap-3">
                                        <Progress value={zone.percentage} className="w-32 h-2" />
                                        <span className="text-sm font-semibold text-foreground min-w-10">
                                          {zone.percentage}%
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Weekly Goals */}
                          <div className="mb-8">
                            <h3 className="text-xl font-bold mb-4 text-foreground">Metas Semanais</h3>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {insights.weeklyGoals.map((goal, index) => (
                                <Card key={index} className="glass-card border-glass-border">
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <TargetIcon className="h-5 w-5 text-primary" />
                                      <Badge variant="outline" className="text-xs">
                                        {Math.round((goal.current / goal.target) * 100)}%
                                      </Badge>
                                    </div>
                                    <h4 className="font-semibold text-sm text-foreground mb-2">{goal.title}</h4>
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Atual: {goal.current} {goal.unit}</span>
                                        <span>Meta: {goal.target} {goal.unit}</span>
                                      </div>
                                      <Progress value={(goal.current / goal.target) * 100} className="h-2" />
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>

                          {/* AI Recommendations */}
                          <div className="mb-8">
                            <h3 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                              <Brain className="h-6 w-6 text-primary" />
                              Recomendações da IA
                            </h3>
                            <div className="space-y-4">
                              {insights.aiRecommendations.map((rec, index) => (
                                <Card key={index} className="glass-card border-glass-border">
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                        <h4 className="font-semibold text-sm text-foreground">{rec.title}</h4>
                                      </div>
                                      <Badge 
                                        variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                                        className="text-xs"
                                      >
                                        {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Média' : 'Baixa'}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>

                          {/* Performance Predictions */}
                          <div className="mb-8">
                            <h3 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                              <BarChart3 className="h-6 w-6 text-primary" />
                              Previsões de Performance
                            </h3>
                            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                              {insights.performancePredictions.map((pred, index) => (
                                <Card key={index} className="glass-card border-glass-border">
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-4">
                                      <h4 className="font-semibold text-sm text-foreground">{pred.metric}</h4>
                                      <Badge variant="outline" className="text-xs">{pred.confidence}% confiança</Badge>
                                    </div>
                                    <div className="space-y-3">
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">Atual</span>
                                        <span className="font-semibold text-foreground">
                                          {pred.currentValue}
                                          {pred.metric.includes('VO₂') ? ' ml/kg/min' : 
                                           pred.metric.includes('Tempo') ? ' min' : ' bpm'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">Previsto em {pred.timeframe}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-primary">
                                            {pred.predictedValue}
                                            {pred.metric.includes('VO₂') ? ' ml/kg/min' : 
                                             pred.metric.includes('Tempo') ? ' min' : ' bpm'}
                                          </span>
                                          {pred.predictedValue > pred.currentValue ? (
                                            <TrendingUp className="h-4 w-4 text-green-500" />
                                          ) : (
                                            <TrendingDown className="h-4 w-4 text-red-500" />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <PremiumBlur message="Insights personalizados é um recurso premium exclusivo para assinantes">
                          <Card className="glass-card border-glass-border">
                            <CardContent className="py-12">
                              <div className="space-y-6">
                                <div className="h-32 bg-muted/20 rounded"></div>
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="h-24 bg-muted/20 rounded"></div>
                                  <div className="h-24 bg-muted/20 rounded"></div>
                                  <div className="h-24 bg-muted/20 rounded"></div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </PremiumBlur>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </ScrollReveal>

        </div>
      </div>
    </div>
  );
};
