import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  TrendingUp, 
  Target,
  Heart,
  Activity,
  Zap,
  Award,
  BarChart3,
  Calendar,
  Clock,
  ArrowRight,
  Lightbulb,
  Star
} from 'lucide-react';

export const Insights = () => {
  const weeklyInsights = [
    {
      type: 'improvement',
      icon: TrendingUp,
      title: 'Zona Aeróbica Otimizada',
      description: 'Você passou 78% do tempo na zona aeróbica ideal esta semana, um aumento de 15% comparado à semana anterior.',
      impact: 'Alto',
      color: 'text-green-400'
    },
    {
      type: 'warning',
      icon: Heart,
      title: 'Variabilidade Cardíaca',
      description: 'Sua HRV diminuiu 8% nos últimos 3 dias. Considere aumentar o tempo de recuperação.',
      impact: 'Médio',
      color: 'text-yellow-400'
    },
    {
      type: 'achievement',
      icon: Award,
      title: 'Novo Recorde Pessoal',
      description: 'Seu VO2 max atingiu 58.4 ml/kg/min - o maior valor dos últimos 6 meses!',
      impact: 'Alto',
      color: 'text-primary'
    }
  ];

  const personalizedMetrics = [
    {
      title: 'VO2 Max',
      current: 58.4,
      target: 62.0,
      unit: 'ml/kg/min',
      progress: 75,
      trend: '+12%',
      recommendation: 'Continue com treinos intervalados em Zona 4-5'
    },
    {
      title: 'Limiar Anaeróbico',
      current: 168,
      target: 175,
      unit: 'bpm',
      progress: 85,
      trend: '+3%',
      recommendation: 'Aumente a duração dos intervalos em alta intensidade'
    },
    {
      title: 'Eficiência Cardíaca',
      current: 87,
      target: 95,
      unit: '%',
      progress: 68,
      trend: '+8%',
      recommendation: 'Foque em corridas longas em ritmo constante'
    }
  ];

  const zoneEffectiveness = [
    { zone: 'Zona 1', percentage: 15, effectiveness: 92, color: 'bg-blue-500', label: 'Recuperação' },
    { zone: 'Zona 2', percentage: 35, effectiveness: 88, color: 'bg-green-500', label: 'Aeróbica Base' },
    { zone: 'Zona 3', percentage: 25, effectiveness: 95, color: 'bg-yellow-500', label: 'Limiar Aeróbico' },
    { zone: 'Zona 4', percentage: 20, effectiveness: 90, color: 'bg-orange-500', label: 'Limiar Anaeróbico' },
    { zone: 'Zona 5', percentage: 5, effectiveness: 85, color: 'bg-red-500', label: 'Potência' }
  ];

  const weeklyGoals = [
    {
      goal: 'Aumentar tempo em Zona 3',
      current: 25,
      target: 30,
      unit: '%',
      status: 'progress'
    },
    {
      goal: 'Reduzir FC de repouso',
      current: 52,
      target: 48,
      unit: 'bpm',
      status: 'progress'
    },
    {
      goal: 'Melhorar recuperação',
      current: 94,
      target: 96,
      unit: '%',
      status: 'achieved'
    }
  ];

  const aiRecommendations = [
    {
      title: 'Plano de Treino Semanal',
      description: 'Baseado na sua evolução, sugerimos 3 treinos intervalados e 2 corridas longas',
      priority: 'high',
      timeToImplement: '1 semana'
    },
    {
      title: 'Otimização de Recuperação',
      description: 'Aumente o tempo de sono em 30min e considere treinos de mobilidade',
      priority: 'medium',
      timeToImplement: '3 dias'
    },
    {
      title: 'Nutrição Pré-Treino',
      description: 'Seus dados mostram melhor performance com carboidratos 2h antes do treino',
      priority: 'medium',
      timeToImplement: 'Imediato'
    }
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Header */}
          <ScrollReveal>
            <div className="text-center mb-12">
              <h1 className="text-4xl lg:text-5xl font-bold mb-4">
                Insights <span className="bg-gradient-primary bg-clip-text text-transparent">Personalizados</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Análise inteligente da sua performance com recomendações baseadas em IA 
                para maximizar seus resultados
              </p>
            </div>
          </ScrollReveal>

          {/* Weekly Insights */}
          <ScrollReveal delay={100}>
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
                <Lightbulb className="h-6 w-6 text-primary" />
                <span>Insights da Semana</span>
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                {weeklyInsights.map((insight, index) => (
                  <Card key={index} className="glass-card border-glass-border">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-3 mb-4">
                        <div className={`p-2 rounded-full bg-${insight.color.split('-')[1]}-500/20`}>
                          <insight.icon className={`h-5 w-5 ${insight.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold">{insight.title}</h3>
                            <Badge variant={insight.impact === 'Alto' ? 'default' : 'secondary'}>
                              {insight.impact}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Personalized Metrics */}
          <ScrollReveal delay={200}>
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                <span>Métricas Personalizadas</span>
              </h2>
              <div className="grid lg:grid-cols-3 gap-6">
                {personalizedMetrics.map((metric, index) => (
                  <Card key={index} className="glass-card border-glass-border">
                    <CardHeader>
                      <CardTitle className="text-lg">{metric.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-end space-x-2">
                          <span className="text-3xl font-bold">{metric.current}</span>
                          <span className="text-muted-foreground">{metric.unit}</span>
                          <span className="text-sm text-green-400 font-medium">{metric.trend}</span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progresso para meta</span>
                            <span>{metric.target} {metric.unit}</span>
                          </div>
                          <Progress value={metric.progress} className="h-2" />
                          <div className="text-sm text-primary">{metric.progress}% completo</div>
                        </div>
                        
                        <div className="p-3 bg-muted/10 rounded-lg">
                          <p className="text-sm">
                            <span className="font-medium text-primary">Recomendação:</span> {metric.recommendation}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Zone Effectiveness */}
          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            <ScrollReveal delay={300}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-primary" />
                    <span>Zona Mais Efetiva da Semana</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {zoneEffectiveness.map((zone, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${zone.color}`} />
                            <span className="font-medium">{zone.zone}</span>
                            <span className="text-sm text-muted-foreground">({zone.label})</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">{zone.percentage}%</span>
                            <Star className={`h-4 w-4 ${zone.effectiveness > 90 ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Progress value={zone.effectiveness} className="flex-1" />
                          <span className="text-sm font-medium">{zone.effectiveness}%</span>
                        </div>
                      </div>
                    ))}
                    <div className="mt-6 p-4 bg-gradient-primary/10 rounded-lg">
                      <h4 className="font-semibold text-primary mb-2">🏆 Zona Destaque</h4>
                      <p className="text-sm">
                        <span className="font-medium">Zona 3 (Limiar Aeróbico)</span> foi sua zona mais efetiva 
                        esta semana com 95% de eficiência. Continue focando nessa intensidade!
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>

            <ScrollReveal delay={400}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <span>Metas Semanais</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {weeklyGoals.map((goal, index) => (
                      <div key={index} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{goal.goal}</h4>
                          <Badge variant={goal.status === 'achieved' ? 'default' : 'secondary'}>
                            {goal.status === 'achieved' ? 'Alcançado' : 'Em Progresso'}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span>{goal.current} {goal.unit}</span>
                              <span>{goal.target} {goal.unit}</span>
                            </div>
                            <Progress 
                              value={(goal.current / goal.target) * 100} 
                              className="h-2" 
                            />
                          </div>
                          <div className="text-sm font-medium">
                            {Math.round((goal.current / goal.target) * 100)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>

          {/* AI Recommendations */}
          <ScrollReveal delay={500}>
            <Card className="glass-card border-glass-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <span>Recomendações Inteligentes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  {aiRecommendations.map((rec, index) => (
                    <div key={index} className="p-6 glass-card rounded-lg space-y-4">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold">{rec.title}</h3>
                        <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                          {rec.priority === 'high' ? 'Alta' : 'Média'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{rec.timeToImplement}</span>
                        </div>
                        <Button size="sm" variant="outline" className="glass-card border-glass-border">
                          Aplicar
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Performance Prediction */}
          <ScrollReveal delay={600}>
            <Card className="glass-card border-glass-border mt-8">
              <CardContent className="p-8">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center space-x-2 mb-4">
                    <Activity className="h-8 w-8 text-primary" />
                    <span className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                      Previsão IA
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold">Seu Potencial nos Próximos 30 Dias</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">+15%</div>
                      <div className="text-sm text-muted-foreground">Melhoria em VO2 Max</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">-5 bpm</div>
                      <div className="text-sm text-muted-foreground">Redução FC Repouso</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">+8%</div>
                      <div className="text-sm text-muted-foreground">Eficiência Global</div>
                    </div>
                  </div>
                  <p className="text-muted-foreground max-w-2xl mx-auto mt-6">
                    Com base no seu padrão atual de treinos e evolução, nossa IA prevê 
                    melhorias significativas em todas as métricas principais. Continue seguindo 
                    as recomendações para alcançar seu máximo potencial.
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