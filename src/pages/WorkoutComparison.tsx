import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, 
  Clock, 
  Heart, 
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  BarChart3,
  Zap,
  Target,
  Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const WorkoutComparison = () => {
  const workouts = [
    {
      id: 1,
      date: '15 Jan 2024',
      type: 'Corrida Intervalada',
      duration: '45:32',
      distance: '8.5 km',
      avgPace: '5:22/km',
      avgHR: 152,
      calories: 542,
      performance: 'Excelente'
    },
    {
      id: 2,
      date: '08 Jan 2024',
      type: 'Corrida Intervalada',
      duration: '44:18',
      distance: '8.0 km',
      avgPace: '5:32/km',
      avgHR: 148,
      calories: 518,
      performance: 'Bom'
    }
  ];

  const comparison = {
    duration: { 
      workout1: '45:32', 
      workout2: '44:18', 
      difference: '+1:14',
      improvement: false
    },
    distance: { 
      workout1: '8.5 km', 
      workout2: '8.0 km', 
      difference: '+0.5 km',
      improvement: true
    },
    pace: { 
      workout1: '5:22/km', 
      workout2: '5:32/km', 
      difference: '-10s/km',
      improvement: true
    },
    heartRate: { 
      workout1: '152 bpm', 
      workout2: '148 bpm', 
      difference: '+4 bpm',
      improvement: false
    },
    calories: { 
      workout1: '542 cal', 
      workout2: '518 cal', 
      difference: '+24 cal',
      improvement: true
    }
  };

  const aiAnalysis = {
    progress: [
      'Melhoria significativa no pace médio (-10s/km)',
      'Aumento da distância percorrida (+6.25%)',
      'Maior gasto calórico por minuto de exercício'
    ],
    regression: [
      'Ligeiro aumento na frequência cardíaca média',
      'Tempo total de treino 1 minuto maior para distância adicional'
    ],
    insights: [
      'Sua eficiência cardiovascular melhorou 8% entre os treinos',
      'Zona de treino ideal foi mantida por mais tempo no treino recente',
      'Cadência se manteve estável, indicando boa forma técnica'
    ]
  };

  const zoneComparison = [
    { zone: 'Zona 1', workout1: 15, workout2: 20, color: 'bg-blue-500' },
    { zone: 'Zona 2', workout1: 25, workout2: 30, color: 'bg-green-500' },
    { zone: 'Zona 3', workout1: 35, workout2: 28, color: 'bg-yellow-500' },
    { zone: 'Zona 4', workout1: 20, workout2: 18, color: 'bg-orange-500' },
    { zone: 'Zona 5', workout1: 5, workout2: 4, color: 'bg-red-500' }
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
              <div className="flex-1">
                <h1 className="text-4xl font-bold">
                  Comparativo de <span className="bg-gradient-primary bg-clip-text text-transparent">Treinos</span>
                </h1>
                <p className="text-muted-foreground">
                  Análise detalhada de progresso entre sessões
                </p>
              </div>
              <div className="flex space-x-4">
                <Select defaultValue="1">
                  <SelectTrigger className="w-48 glass-card border-glass-border">
                    <SelectValue placeholder="Selecionar treino 1" />
                  </SelectTrigger>
                  <SelectContent className="glass-card border-glass-border">
                    <SelectItem value="1">15 Jan - Corrida Intervalada</SelectItem>
                    <SelectItem value="2">13 Jan - Ciclismo</SelectItem>
                    <SelectItem value="3">11 Jan - Natação</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="2">
                  <SelectTrigger className="w-48 glass-card border-glass-border">
                    <SelectValue placeholder="Selecionar treino 2" />
                  </SelectTrigger>
                  <SelectContent className="glass-card border-glass-border">
                    <SelectItem value="1">15 Jan - Corrida Intervalada</SelectItem>
                    <SelectItem value="2">08 Jan - Corrida Intervalada</SelectItem>
                    <SelectItem value="3">06 Jan - Corrida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollReveal>

          {/* Workout Cards */}
          <ScrollReveal delay={100}>
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {workouts.map((workout, index) => (
                <Card key={workout.id} className="glass-card border-glass-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <Activity className="h-5 w-5 text-primary" />
                        <span>Treino {index + 1}</span>
                      </CardTitle>
                      <Badge variant={workout.performance === 'Excelente' ? 'default' : 'secondary'}>
                        {workout.performance}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{workout.date}</span>
                      <Badge variant="outline">{workout.type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
                        <div className="font-bold">{workout.duration}</div>
                        <div className="text-xs text-muted-foreground">Duração</div>
                      </div>
                      <div className="text-center">
                        <Target className="h-5 w-5 text-primary mx-auto mb-1" />
                        <div className="font-bold">{workout.distance}</div>
                        <div className="text-xs text-muted-foreground">Distância</div>
                      </div>
                      <div className="text-center">
                        <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
                        <div className="font-bold">{workout.avgPace}</div>
                        <div className="text-xs text-muted-foreground">Pace</div>
                      </div>
                      <div className="text-center">
                        <Heart className="h-5 w-5 text-primary mx-auto mb-1" />
                        <div className="font-bold">{workout.avgHR}</div>
                        <div className="text-xs text-muted-foreground">FC Média</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollReveal>

          {/* Comparison Metrics */}
          <ScrollReveal delay={200}>
            <Card className="glass-card border-glass-border mb-8">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <span>Comparação de Métricas</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(comparison).map(([key, data]) => (
                    <div key={key} className="flex items-center justify-between p-4 glass-card rounded-lg">
                      <div className="capitalize font-medium">
                        {key === 'heartRate' ? 'Frequência Cardíaca' : 
                         key === 'distance' ? 'Distância' :
                         key === 'duration' ? 'Duração' :
                         key === 'pace' ? 'Pace Médio' :
                         key === 'calories' ? 'Calorias' : key}
                      </div>
                      
                      <div className="flex items-center space-x-8">
                        <div className="text-center">
                          <div className="font-bold">{data.workout1}</div>
                          <div className="text-xs text-muted-foreground">Treino 1</div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {data.improvement ? (
                            <TrendingUp className="h-4 w-4 text-green-400" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-yellow-400" />
                          )}
                          <span className={`font-medium ${
                            data.improvement ? 'text-green-400' : 'text-yellow-400'
                          }`}>
                            {data.difference}
                          </span>
                        </div>
                        
                        <div className="text-center">
                          <div className="font-bold">{data.workout2}</div>
                          <div className="text-xs text-muted-foreground">Treino 2</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Zone Comparison */}
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            <ScrollReveal delay={300}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Heart className="h-5 w-5 text-primary" />
                    <span>Comparação por Zona</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {zoneComparison.map((zone, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{zone.zone}</span>
                          <div className="flex items-center space-x-4">
                            <span className="text-sm">{zone.workout1}%</span>
                            <span className="text-xs text-muted-foreground">vs</span>
                            <span className="text-sm">{zone.workout2}%</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 space-y-1">
                            <div className="flex space-x-1">
                              <div className="flex-1 bg-muted/20 rounded-full h-2">
                                <div 
                                  className={`${zone.color} h-2 rounded-full transition-all duration-500`}
                                  style={{ width: `${zone.workout1}%` }}
                                />
                              </div>
                              <div className="flex-1 bg-muted/20 rounded-full h-2">
                                <div 
                                  className={`${zone.color} opacity-60 h-2 rounded-full transition-all duration-500`}
                                  style={{ width: `${zone.workout2}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className={`w-3 h-3 rounded-full ${zone.color}`} />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-center space-x-4 mt-4 text-xs text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-2 bg-primary rounded" />
                        <span>Treino 1</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-2 bg-primary opacity-60 rounded" />
                        <span>Treino 2</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>

            {/* AI Analysis */}
            <ScrollReveal delay={400}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="h-5 w-5 text-primary" />
                    <span>Análise Inteligente</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold text-green-400 mb-3 flex items-center space-x-2">
                        <TrendingUp className="h-4 w-4" />
                        <span>Progressos Identificados</span>
                      </h4>
                      <div className="space-y-2">
                        {aiAnalysis.progress.map((item, index) => (
                          <div key={index} className="flex items-start space-x-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 flex-shrink-0" />
                            <p className="text-sm">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-yellow-400 mb-3 flex items-center space-x-2">
                        <TrendingDown className="h-4 w-4" />
                        <span>Pontos de Atenção</span>
                      </h4>
                      <div className="space-y-2">
                        {aiAnalysis.regression.map((item, index) => (
                          <div key={index} className="flex items-start space-x-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-2 flex-shrink-0" />
                            <p className="text-sm">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-primary mb-3 flex items-center space-x-2">
                        <Activity className="h-4 w-4" />
                        <span>Insights IA</span>
                      </h4>
                      <div className="space-y-2">
                        {aiAnalysis.insights.map((item, index) => (
                          <div key={index} className="flex items-start space-x-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                            <p className="text-sm">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>

          {/* Overall Progress Summary */}
          <ScrollReveal delay={500}>
            <Card className="glass-card border-glass-border">
              <CardContent className="p-8">
                <div className="text-center">
                  <div className="inline-flex items-center space-x-2 mb-4">
                    <TrendingUp className="h-8 w-8 text-green-400" />
                    <span className="text-3xl font-bold text-green-400">+8.2%</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Melhoria Geral de Performance</h3>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    Baseado na análise comparativa, você demonstrou uma evolução consistente 
                    em eficiência cardiovascular e resistência. Continue focando em treinos 
                    intervalados para maximizar seus ganhos.
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