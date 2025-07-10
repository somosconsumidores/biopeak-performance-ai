import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  BarChart3
} from 'lucide-react';

export const Dashboard = () => {
  const alerts = [
    {
      type: 'warning',
      icon: AlertTriangle,
      title: 'Risco de Overtraining',
      message: 'Seus índices de fadiga estão elevados. Considere um dia de recuperação.',
      priority: 'high'
    },
    {
      type: 'success',
      icon: TrendingUp,
      title: 'Performance em Alta',
      message: 'Seu VO2 max aumentou 3% nas últimas duas semanas.',
      priority: 'medium'
    }
  ];

  const weeklyData = [
    { day: 'Seg', training: 85, recovery: 70 },
    { day: 'Ter', training: 90, recovery: 65 },
    { day: 'Qua', training: 75, recovery: 80 },
    { day: 'Qui', training: 95, recovery: 60 },
    { day: 'Sex', training: 80, recovery: 75 },
    { day: 'Sáb', training: 100, recovery: 55 },
    { day: 'Dom', training: 40, recovery: 95 }
  ];

  const metrics = [
    {
      title: 'VO2 Max',
      value: '58.4',
      unit: 'ml/kg/min',
      change: '+12%',
      trend: 'up',
      color: 'text-green-400'
    },
    {
      title: 'Frequência Cardíaca',
      value: '152',
      unit: 'bpm médio',
      change: '-3%',
      trend: 'down',
      color: 'text-blue-400'
    },
    {
      title: 'Zona de Treino',
      value: '3-4',
      unit: 'zona ótima',
      change: '85%',
      trend: 'up',
      color: 'text-purple-400'
    },
    {
      title: 'Recuperação',
      value: '94%',
      unit: 'nível atual',
      change: '+8%',
      trend: 'up',
      color: 'text-green-400'
    }
  ];

  const recentWorkouts = [
    {
      date: '2024-01-15',
      type: 'Corrida',
      duration: '45:32',
      distance: '8.5 km',
      avgPace: '5:22/km',
      performance: 'Excelente',
      color: 'bg-green-500'
    },
    {
      date: '2024-01-13',
      type: 'Ciclismo',
      duration: '1:22:15',
      distance: '35.2 km',
      avgPace: '28.5 km/h',
      performance: 'Bom',
      color: 'bg-blue-500'
    },
    {
      date: '2024-01-11',
      type: 'Natação',
      duration: '32:40',
      distance: '1.2 km',
      avgPace: '2:43/100m',
      performance: 'Regular',
      color: 'bg-yellow-500'
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
              {alerts.map((alert, index) => (
                <Card key={index} className="glass-card border-glass-border">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-full ${
                        alert.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        <alert.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold">{alert.title}</h3>
                          <Badge variant={alert.priority === 'high' ? 'destructive' : 'secondary'}>
                            {alert.priority === 'high' ? 'Alta' : 'Média'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollReveal>

          {/* Main Metrics */}
          <ScrollReveal delay={200}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {metrics.map((metric, index) => (
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
                          strokeDasharray={`${2 * Math.PI * 56 * 0.87} ${2 * Math.PI * 56}`}
                          className="data-glow"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-2xl font-bold">87%</div>
                          <div className="text-xs text-muted-foreground">Atual</div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        Previsão de pico: <span className="text-primary font-medium">Janeiro 25</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Potencial máximo: <span className="text-primary font-medium">95%</span>
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
                  {recentWorkouts.map((workout, index) => (
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