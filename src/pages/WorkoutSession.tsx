import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLatestActivity } from '@/hooks/useLatestActivity';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const WorkoutSession = () => {
  const { activity, loading, error } = useLatestActivity();

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

  if (error || !activity) {
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

  // Mock AI insights (would come from AI analysis in real implementation)
  const aiInsights = {
    whatWorked: [
      'Ritmo constante manteve você na zona aeróbica ideal',
      'Frequência cardíaca controlada durante a maior parte do exercício',
      'Boa distribuição de energia ao longo da atividade'
    ],
    toImprove: [
      'Considere um aquecimento mais longo para melhor performance',
      'Monitore a hidratação durante exercícios mais longos',
      'Trabalhe na resistência para manter o ritmo'
    ],
    recommendations: [
      'Próximo treino: Foco em resistência aeróbica',
      'Tempo de recuperação recomendado: 18-24 horas',
      'Considere exercícios complementares de força'
    ]
  };

  // Mock heart rate zones (would be calculated from real data)
  const heartRateZones = [
    { zone: 'Zona 1', percentage: 15, color: 'bg-blue-500', label: 'Recuperação' },
    { zone: 'Zona 2', percentage: 35, color: 'bg-green-500', label: 'Aeróbica' },
    { zone: 'Zona 3', percentage: 30, color: 'bg-yellow-500', label: 'Limiar' },
    { zone: 'Zona 4', percentage: 15, color: 'bg-orange-500', label: 'Anaeróbica' },
    { zone: 'Zona 5', percentage: 5, color: 'bg-red-500', label: 'Máxima' }
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Header */}
          <ScrollReveal>
            <div className="flex items-center space-x-4 mb-8">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon" className="glass-card border-glass-border">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-4xl font-bold">
                  Análise da <span className="bg-gradient-primary bg-clip-text text-transparent">Sessão</span>
                </h1>
                <p className="text-muted-foreground flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(activity.start_time_in_seconds)}</span>
                  <Badge variant="outline">{getActivityType(activity.activity_type)}</Badge>
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* Workout Summary */}
          <ScrollReveal delay={100}>
            <Card className="glass-card border-glass-border mb-8">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <span>Resumo do Treino</span>
                  <Badge variant="default">
                    Concluído
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  <div className="text-center">
                    <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{formatDuration(activity.duration_in_seconds)}</div>
                    <div className="text-sm text-muted-foreground">Duração</div>
                  </div>
                  <div className="text-center">
                    <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{formatDistance(activity.distance_in_meters)}</div>
                    <div className="text-sm text-muted-foreground">Distância</div>
                  </div>
                  <div className="text-center">
                    <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{formatPace(activity.average_pace_in_minutes_per_kilometer)}</div>
                    <div className="text-sm text-muted-foreground">Pace Médio</div>
                  </div>
                  <div className="text-center">
                    <Zap className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{activity.active_kilocalories || '--'}</div>
                    <div className="text-sm text-muted-foreground">Calorias</div>
                  </div>
                  <div className="text-center">
                    <Heart className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{activity.average_heart_rate_in_beats_per_minute || '--'}</div>
                    <div className="text-sm text-muted-foreground">FC Média</div>
                  </div>
                  <div className="text-center">
                    <BarChart3 className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{formatElevation(activity.total_elevation_gain_in_meters)}</div>
                    <div className="text-sm text-muted-foreground">Elevação</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* AI Analysis */}
          <div className="grid lg:grid-cols-3 gap-8 mb-8">
            {/* What Worked */}
            <ScrollReveal delay={200}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-green-400">
                    <ThumbsUp className="h-5 w-5" />
                    <span>O que Funcionou</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {aiInsights.whatWorked.map((insight, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-2 h-2 rounded-full bg-green-400 mt-2 flex-shrink-0" />
                        <p className="text-sm">{insight}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>

            {/* To Improve */}
            <ScrollReveal delay={300}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-yellow-400">
                    <ThumbsDown className="h-5 w-5" />
                    <span>Para Melhorar</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {aiInsights.toImprove.map((insight, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-2 h-2 rounded-full bg-yellow-400 mt-2 flex-shrink-0" />
                        <p className="text-sm">{insight}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>

            {/* Recommendations */}
            <ScrollReveal delay={400}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-primary">
                    <Brain className="h-5 w-5" />
                    <span>Recomendações IA</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {aiInsights.recommendations.map((insight, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <p className="text-sm">{insight}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>

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
                  <div className="space-y-4">
                    {heartRateZones.map((zone, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{zone.zone}</span>
                          <span className="text-sm text-muted-foreground">{zone.percentage}%</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Progress value={zone.percentage} className="flex-1" />
                          <div className={`w-3 h-3 rounded-full ${zone.color}`} />
                          <span className="text-xs text-muted-foreground w-20">{zone.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
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
                        {activity.max_heart_rate_in_beats_per_minute || '--'}
                      </div>
                      <div className="text-sm text-muted-foreground">FC Máxima</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary mb-1">
                        {activity.device_name || 'Dispositivo'}
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
    </div>
  );
};