import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, 
  Clock, 
  MapPin, 
  Heart, 
  Zap, 
  TrendingUp,
  Brain,
  Target,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  Calendar,
  AlertCircle,
  ChevronDown,
  Share2
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLatestActivity } from '@/hooks/useLatestActivity';
import { useUnifiedActivityHistory } from '@/hooks/useUnifiedActivityHistory';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { HeartRatePaceChart } from '@/components/HeartRatePaceChart';
import { useHeartRateZones } from '@/hooks/useHeartRateZones';
import { AIInsightsCard } from '@/components/AIInsightsCard';
import { ShareWorkoutDialog } from '@/components/ShareWorkoutDialog';
import { PerformanceIndicators } from '@/components/PerformanceIndicators';
import { ActivitySourceInfo } from '@/components/ActivitySourceInfo';
import type { UnifiedActivity } from '@/hooks/useUnifiedActivityHistory';


export const WorkoutSession = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    searchParams.get('activityId')
  );
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const { user } = useAuth();
  
  const { activity: latestActivity, loading: latestLoading, error: latestError } = useLatestActivity();
  const { activities, loading: historyLoading, error: historyError, getActivityById, formatActivityDisplay, refetch } = useUnifiedActivityHistory();
  
  // Determine which activity to show - prioritize unified activities
  const currentActivity = selectedActivityId ? getActivityById(selectedActivityId) : 
    (activities.length > 0 ? activities[0] : latestActivity);
  const loading = latestLoading || historyLoading;
  const error = latestError || historyError;

  // Get heart rate zones data - use currentActivity.activity_id
  console.log('🔍 WORKOUTSESSION: currentActivity for zones:', currentActivity?.activity_id);
  const { zones: heartRateZones, loading: zonesLoading } = useHeartRateZones(currentActivity?.activity_id || null);

  // Update URL when activity is selected
  useEffect(() => {
    if (selectedActivityId) {
      setSearchParams({ activityId: selectedActivityId });
    } else {
      setSearchParams({});
    }
  }, [selectedActivityId, setSearchParams]);

  // Refetch activities when navigating to this page to ensure latest data
  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleActivitySelect = (activityId: string) => {
    setSelectedActivityId(activityId === 'latest' ? null : activityId);
  };

  // Helper functions to format data
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number | null) => {
    if (!meters) return '--';
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatPace = (paceInMinutes: number | null) => {
    if (!paceInMinutes) return '--';
    const minutes = Math.floor(paceInMinutes);
    const seconds = Math.round((paceInMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const formatElevation = (meters: number | null) => {
    if (!meters) return '--';
    return `${Math.round(meters)}m`;
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Data não disponível';
    return format(new Date(timestamp * 1000), 'dd \'de\' MMMM, yyyy', { locale: ptBR });
  };

  const getActivityType = (type: string | null) => {
    if (!type) return 'Atividade';
    const typeMap: { [key: string]: string } = {
      'running': 'Corrida',
      'cycling': 'Ciclismo', 
      'walking': 'Caminhada',
      'swimming': 'Natação',
      'fitness_equipment': 'Academia'
    };
    return typeMap[type.toLowerCase()] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando análise da sessão...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !currentActivity) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="flex items-center space-x-4 mb-8">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon" className="glass-card border-glass-border">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-4xl font-bold">
                Análise da <span className="bg-gradient-primary bg-clip-text text-transparent">Sessão</span>
              </h1>
            </div>
            <Card className="glass-card border-glass-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma atividade encontrada</h3>
                <p className="text-muted-foreground text-center mb-6">
                  {error || 'Sincronize suas atividades do Garmin para ver a análise detalhada.'}
                </p>
                <Link to="/sync">
                  <Button>Sincronizar Atividades</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Activity Selector */}
          <ScrollReveal>
            <Card className="glass-card border-glass-border mb-8">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span>Selecionar Atividade</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select 
                  value={selectedActivityId || 'latest'} 
                  onValueChange={handleActivitySelect}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Escolha uma atividade do seu histórico" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="latest">Última Atividade</SelectItem>
                    {activities.map((activity) => (
                      <SelectItem key={activity.id} value={activity.id}>
                        {formatActivityDisplay(activity)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Header */}
          <ScrollReveal>
            <div className="flex items-center space-x-4 mb-8">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon" className="glass-card border-glass-border">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-bold">
                  Análise da <span className="bg-gradient-primary bg-clip-text text-transparent">Sessão</span>
                </h1>
                <p className="text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 mt-2">
                  <span className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(currentActivity.start_time_in_seconds)}</span>
                    <Badge variant="outline">{getActivityType(currentActivity.activity_type)}</Badge>
                  </span>
                  <span className="text-xs sm:text-sm text-muted-foreground/80 italic">
                    {(currentActivity as any)?.source || 'GARMIN'} {currentActivity.device_name || 'dispositivo desconhecido'}
                  </span>
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* Workout Summary */}
          <ScrollReveal delay={100}>
            <Card className="glass-card border-glass-border mb-8">
              <CardHeader>
                <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <span>Resumo do Treino</span>
                    <Badge variant="default">
                      Concluído
                    </Badge>
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShareDialogOpen(true)}
                    className="glass-card border-glass-border hover:bg-glass-bg-hover group touch-manipulation min-h-[44px] px-4 w-full sm:w-auto"
                  >
                    <Share2 className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                    <span>Compartilhar</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
                  <div className="text-center">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-primary mx-auto mb-2" />
                    <div className="text-lg sm:text-2xl font-bold">{formatDuration(currentActivity.duration_in_seconds)}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">Duração</div>
                  </div>
                  <div className="text-center">
                    <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-primary mx-auto mb-2" />
                    <div className="text-lg sm:text-2xl font-bold">{formatDistance(currentActivity.distance_in_meters)}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">Distância</div>
                  </div>
                  <div className="text-center">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary mx-auto mb-2" />
                    <div className="text-lg sm:text-2xl font-bold">{formatPace(currentActivity.average_pace_in_minutes_per_kilometer)}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">Pace Médio</div>
                  </div>
                  <div className="text-center">
                    <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-primary mx-auto mb-2" />
                    <div className="text-lg sm:text-2xl font-bold">{currentActivity.active_kilocalories || '--'}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">Calorias</div>
                  </div>
                  <div className="text-center">
                    <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-primary mx-auto mb-2" />
                    <div className="text-lg sm:text-2xl font-bold">{currentActivity.average_heart_rate_in_beats_per_minute || '--'}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">FC Média</div>
                  </div>
                  <div className="text-center">
                    <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary mx-auto mb-2" />
                    <div className="text-lg sm:text-2xl font-bold">{formatElevation(currentActivity.total_elevation_gain_in_meters)}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">Elevação</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Heart Rate vs Pace Chart */}
          <ScrollReveal delay={150}>
            <div className="mb-8">
              <ActivitySourceInfo 
                activity={currentActivity as UnifiedActivity} 
                feature="heart_rate" 
              />
              <HeartRatePaceChart 
                activityId={currentActivity.activity_id} 
                activityStartTime={currentActivity.start_time_in_seconds}
                activityDate={currentActivity.activity_date}
              />
            </div>
          </ScrollReveal>

          {/* Performance Indicators */}
          <ScrollReveal delay={175}>
            <div className="mb-8 mt-8">
              <ActivitySourceInfo 
                activity={currentActivity as UnifiedActivity} 
                feature="detailed_metrics" 
              />
              <PerformanceIndicators activityId={currentActivity.activity_id} />
            </div>
          </ScrollReveal>

          {/* AI Analysis */}
          <ScrollReveal delay={200}>
            <div className="mb-8 mt-8">
              <ActivitySourceInfo 
                activity={currentActivity as UnifiedActivity} 
                feature="performance_analysis" 
              />
            {user?.email === 'garminteste07@teste.com' && (
              <AIInsightsCard activityId={currentActivity.activity_id} />
            )}
            </div>
          </ScrollReveal>

          {/* Heart Rate Zones */}
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            <ScrollReveal delay={500}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Heart className="h-5 w-5 text-primary" />
                    <span>Distribuição por Zona</span>
                  </CardTitle>
                </CardHeader>
                 <CardContent>
                   {zonesLoading ? (
                     <div className="text-center py-4">
                       <p className="text-muted-foreground">Calculando zonas...</p>
                     </div>
                   ) : heartRateZones.length > 0 ? (
                     <div className="space-y-4">
                       {heartRateZones.map((zone, index) => (
                         <div key={index} className="space-y-2">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center space-x-3">
                               <div className={`w-3 h-3 rounded-full ${zone.color}`} />
                               <span className="text-sm font-medium">{zone.zone}</span>
                               <span className="text-xs text-muted-foreground">({zone.label})</span>
                               <span className="text-xs text-muted-foreground">{zone.minHR}-{zone.maxHR} bpm</span>
                             </div>
                             <div className="flex items-center space-x-2">
                               <span className="text-sm">{zone.percentage}%</span>
                               <span className="text-xs text-muted-foreground">
                                 {Math.floor(zone.timeInZone / 60)}:{(zone.timeInZone % 60).toString().padStart(2, '0')}
                               </span>
                             </div>
                           </div>
                           <Progress value={zone.percentage} className="flex-1" />
                         </div>
                       ))}
                     </div>
                   ) : (
                     <div className="text-center py-4">
                       <p className="text-muted-foreground">Dados de zona não disponíveis</p>
                     </div>
                   )}
                </CardContent>
              </Card>
            </ScrollReveal>

            {/* Performance Summary */}
            <ScrollReveal delay={600}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-primary" />
                    <span>Resumo de Performance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary mb-1">
                        {currentActivity.max_heart_rate_in_beats_per_minute || '--'}
                      </div>
                      <div className="text-sm text-muted-foreground">FC Máxima</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary mb-1">
                        {currentActivity.device_name || 'Dispositivo'}
                      </div>
                      <div className="text-sm text-muted-foreground">Equipamento</div>
                    </div>
                  </div>
                  <div className="mt-6 p-4 bg-muted/10 rounded-lg">
                    <p className="text-sm text-center">
                      <span className="font-medium text-primary">Análise:</span> Atividade registrada com sucesso. 
                      Os dados mostram um bom desempenho geral com métricas consistentes.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>

          {/* Recovery Feedback */}
          <ScrollReveal delay={700}>
            <Card className="glass-card border-glass-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <span>Feedback de Recuperação</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-400 mb-2">18-24h</div>
                    <div className="text-sm text-muted-foreground">Tempo de Recuperação</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-400 mb-2">7-8h</div>
                    <div className="text-sm text-muted-foreground">Sono Recomendado</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-400 mb-2">2.5L</div>
                    <div className="text-sm text-muted-foreground">Hidratação Hoje</div>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-muted/10 rounded-lg">
                  <p className="text-sm text-center">
                    <span className="font-medium text-primary">Dica da IA:</span> Baseado na intensidade 
                    deste treino, evite exercícios de alta intensidade pelos próximos 2 dias. 
                    Foque em recuperação ativa com caminhadas leves.
                  </p>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>
      </div>

      {/* Share Dialog */}
      {currentActivity && (
        <ShareWorkoutDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          workoutData={currentActivity}
        />
      )}
    </div>
  );
};
