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
  Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const WorkoutSession = () => {
  const workoutData = {
    date: '15 de Janeiro, 2024',
    type: 'Corrida Intervalada',
    duration: '45:32',
    distance: '8.5 km',
    avgPace: '5:22/km',
    calories: 542,
    avgHR: 152,
    maxHR: 178,
    elevationGain: 89,
    performance: 'Excelente'
  };

  const aiInsights = {
    whatWorked: [
      'Ritmo constante nos primeiros 5km manteve você na zona aeróbica ideal',
      'Intervalos de alta intensidade melhoraram 8% comparado ao treino anterior',
      'Cadência de 180 spm otimizou sua eficiência energética'
    ],
    toImprove: [
      'Frequência cardíaca subiu muito rápido no 6º km - considere aquecimento mais longo',
      'Último quilômetro mostrou fadiga muscular - foque em exercícios de resistência',
      'Hidratação pode ter sido insuficiente baseada na variabilidade cardíaca'
    ],
    recommendations: [
      'Próximo treino: Foco em resistência aeróbica (Zona 2)',
      'Tempo de recuperação recomendado: 18-24 horas',
      'Considere treino de força para membros inferiores'
    ]
  };

  const heartRateZones = [
    { zone: 'Zona 1', percentage: 15, color: 'bg-blue-500', label: 'Recuperação' },
    { zone: 'Zona 2', percentage: 25, color: 'bg-green-500', label: 'Aeróbica' },
    { zone: 'Zona 3', percentage: 35, color: 'bg-yellow-500', label: 'Limiar' },
    { zone: 'Zona 4', percentage: 20, color: 'bg-orange-500', label: 'Anaeróbica' },
    { zone: 'Zona 5', percentage: 5, color: 'bg-red-500', label: 'Máxima' }
  ];

  const paceAnalysis = [
    { km: '1', pace: '5:45', hr: 135, zone: 'Zona 2' },
    { km: '2', pace: '5:38', hr: 142, zone: 'Zona 2' },
    { km: '3', pace: '5:15', hr: 155, zone: 'Zona 3' },
    { km: '4', pace: '4:58', hr: 168, zone: 'Zona 4' },
    { km: '5', pace: '5:02', hr: 165, zone: 'Zona 4' },
    { km: '6', pace: '5:28', hr: 158, zone: 'Zona 3' },
    { km: '7', pace: '5:35', hr: 152, zone: 'Zona 3' },
    { km: '8', pace: '5:42', hr: 148, zone: 'Zona 2' }
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
                  <span>{workoutData.date}</span>
                  <Badge variant="outline">{workoutData.type}</Badge>
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
                  <Badge variant={workoutData.performance === 'Excelente' ? 'default' : 'secondary'}>
                    {workoutData.performance}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  <div className="text-center">
                    <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{workoutData.duration}</div>
                    <div className="text-sm text-muted-foreground">Duração</div>
                  </div>
                  <div className="text-center">
                    <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{workoutData.distance}</div>
                    <div className="text-sm text-muted-foreground">Distância</div>
                  </div>
                  <div className="text-center">
                    <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{workoutData.avgPace}</div>
                    <div className="text-sm text-muted-foreground">Pace Médio</div>
                  </div>
                  <div className="text-center">
                    <Zap className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{workoutData.calories}</div>
                    <div className="text-sm text-muted-foreground">Calorias</div>
                  </div>
                  <div className="text-center">
                    <Heart className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{workoutData.avgHR}</div>
                    <div className="text-sm text-muted-foreground">FC Média</div>
                  </div>
                  <div className="text-center">
                    <BarChart3 className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{workoutData.elevationGain}m</div>
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

            {/* Pace Analysis */}
            <ScrollReveal delay={600}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-primary" />
                    <span>Análise por Quilômetro</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {paceAnalysis.map((km, index) => (
                      <div key={index} className="flex items-center justify-between p-3 glass-card rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-bold">
                            {km.km}
                          </div>
                          <div>
                            <div className="font-medium">{km.pace}</div>
                            <div className="text-xs text-muted-foreground">Pace</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{km.hr} bpm</div>
                          <div className="text-xs text-muted-foreground">{km.zone}</div>
                        </div>
                      </div>
                    ))}
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