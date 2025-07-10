import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  User, 
  Settings, 
  Target,
  Trophy,
  Calendar,
  Activity,
  Heart,
  Zap,
  BarChart3,
  Camera,
  Edit,
  Star,
  TrendingUp,
  Award
} from 'lucide-react';

export const Profile = () => {
  const userStats = {
    name: 'Carlos Silva',
    email: 'carlos@email.com',
    age: 32,
    weight: 75,
    height: 178,
    memberSince: 'Janeiro 2023',
    totalWorkouts: 245,
    totalDistance: '1,850 km',
    avgWeeklyWorkouts: 4.2,
    currentStreak: 12
  };

  const fitnessLevel = {
    overall: 87,
    cardiovascular: 92,
    strength: 78,
    endurance: 89,
    recovery: 85
  };

  const personalBests = [
    { metric: '5K Corrida', value: '19:45', date: '15 Jan 2024', improvement: '+30s' },
    { metric: '10K Corrida', value: '42:15', date: '08 Jan 2024', improvement: '+1:20' },
    { metric: 'VO2 Max', value: '58.4 ml/kg/min', date: '15 Jan 2024', improvement: '+2.8' },
    { metric: 'FC Repouso', value: '52 bpm', date: '10 Jan 2024', improvement: '-3 bpm' }
  ];

  const achievements = [
    { 
      title: 'Sequência de Ouro', 
      description: '30 dias consecutivos de treino',
      icon: Trophy,
      color: 'text-yellow-400',
      completed: true,
      date: '15 Jan 2024'
    },
    { 
      title: 'Maratonista', 
      description: 'Completar 1000km em um ano',
      icon: Target,
      color: 'text-blue-400',
      completed: true,
      date: '28 Dez 2023'
    },
    { 
      title: 'Evolução IA', 
      description: 'Seguir 90% das recomendações IA',
      icon: Star,
      color: 'text-purple-400',
      completed: true,
      date: '05 Jan 2024'
    },
    { 
      title: 'Zona Master', 
      description: 'Dominar todas as 5 zonas de treino',
      icon: Heart,
      color: 'text-red-400',
      completed: false,
      progress: 85
    }
  ];

  const goals = [
    {
      title: 'Correr 5K em menos de 19 minutos',
      current: 19.75,
      target: 19.0,
      unit: 'min',
      deadline: 'Mar 2024',
      progress: 75
    },
    {
      title: 'Atingir VO2 Max de 62 ml/kg/min',
      current: 58.4,
      target: 62.0,
      unit: 'ml/kg/min',
      deadline: 'Abr 2024',
      progress: 68
    },
    {
      title: 'Completar 300 treinos no ano',
      current: 245,
      target: 300,
      unit: 'treinos',
      deadline: 'Dez 2024',
      progress: 82
    }
  ];

  const monthlyStats = [
    { month: 'Set', workouts: 18, distance: 145 },
    { month: 'Out', workouts: 20, distance: 168 },
    { month: 'Nov', workouts: 22, distance: 185 },
    { month: 'Dez', workouts: 19, distance: 156 },
    { month: 'Jan', workouts: 16, distance: 132 }
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Profile Header */}
          <ScrollReveal>
            <Card className="glass-card border-glass-border mb-8">
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
                  <div className="relative">
                    <Avatar className="w-24 h-24">
                      <AvatarImage src="/placeholder-avatar.jpg" />
                      <AvatarFallback className="text-2xl font-bold bg-gradient-primary text-white">
                        {userStats.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <Button size="icon" variant="outline" className="absolute -bottom-2 -right-2 glass-card border-glass-border">
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div>
                      <h1 className="text-3xl font-bold">{userStats.name}</h1>
                      <p className="text-muted-foreground">{userStats.email}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                        <span>{userStats.age} anos</span>
                        <span>•</span>
                        <span>{userStats.weight}kg</span>
                        <span>•</span>
                        <span>{userStats.height}cm</span>
                        <span>•</span>
                        <span>Membro desde {userStats.memberSince}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{userStats.totalWorkouts}</div>
                        <div className="text-xs text-muted-foreground">Total Treinos</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{userStats.totalDistance}</div>
                        <div className="text-xs text-muted-foreground">Distância Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{userStats.avgWeeklyWorkouts}</div>
                        <div className="text-xs text-muted-foreground">Treinos/Semana</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{userStats.currentStreak}</div>
                        <div className="text-xs text-muted-foreground">Sequência Atual</div>
                      </div>
                    </div>
                  </div>
                  
                  <Button className="btn-primary">
                    <Edit className="mr-2 h-4 w-4" />
                    Editar Perfil
                  </Button>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Fitness Level */}
          <ScrollReveal delay={100}>
            <Card className="glass-card border-glass-border mb-8">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <span>Nível de Performance</span>
                  <Badge variant="default" className="ml-auto">
                    Nível {Math.floor(fitnessLevel.overall / 10)} - Avançado
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-5 gap-6">
                  {Object.entries(fitnessLevel).map(([key, value]) => (
                    <div key={key} className="text-center space-y-3">
                      <div className="relative w-20 h-20 mx-auto">
                        <svg className="w-20 h-20 transform -rotate-90">
                          <circle
                            cx="40"
                            cy="40"
                            r="36"
                            stroke="hsl(var(--muted))"
                            strokeWidth="6"
                            fill="transparent"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="36"
                            stroke="hsl(var(--primary))"
                            strokeWidth="6"
                            fill="transparent"
                            strokeDasharray={`${2 * Math.PI * 36 * (value / 100)} ${2 * Math.PI * 36}`}
                            className="data-glow"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold">{value}%</span>
                        </div>
                      </div>
                      <div className="text-sm font-medium capitalize">
                        {key === 'overall' ? 'Geral' :
                         key === 'cardiovascular' ? 'Cardiovascular' :
                         key === 'strength' ? 'Força' :
                         key === 'endurance' ? 'Resistência' :
                         'Recuperação'}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Personal Bests & Achievements */}
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            <ScrollReveal delay={200}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    <span>Recordes Pessoais</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {personalBests.map((record, index) => (
                      <div key={index} className="flex items-center justify-between p-4 glass-card rounded-lg">
                        <div>
                          <div className="font-medium">{record.metric}</div>
                          <div className="text-sm text-muted-foreground">{record.date}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg">{record.value}</div>
                          <div className="text-sm text-green-400 flex items-center">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {record.improvement}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Award className="h-5 w-5 text-primary" />
                    <span>Conquistas</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {achievements.map((achievement, index) => (
                      <div key={index} className="flex items-center space-x-4 p-4 glass-card rounded-lg">
                        <div className={`p-2 rounded-full ${achievement.completed ? 'bg-green-500/20' : 'bg-muted/20'}`}>
                          <achievement.icon className={`h-5 w-5 ${achievement.completed ? achievement.color : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{achievement.title}</div>
                          <div className="text-sm text-muted-foreground">{achievement.description}</div>
                          {!achievement.completed && achievement.progress && (
                            <div className="mt-2">
                              <Progress value={achievement.progress} className="h-1" />
                              <div className="text-xs text-muted-foreground mt-1">{achievement.progress}% completo</div>
                            </div>
                          )}
                        </div>
                        {achievement.completed && (
                          <Badge variant="default">Completo</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>

          {/* Goals */}
          <ScrollReveal delay={400}>
            <Card className="glass-card border-glass-border mb-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-primary" />
                    <span>Metas Atuais</span>
                  </CardTitle>
                  <Button variant="outline" size="sm" className="glass-card border-glass-border">
                    <Settings className="mr-2 h-4 w-4" />
                    Configurar Metas
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  {goals.map((goal, index) => (
                    <div key={index} className="space-y-4">
                      <div>
                        <h3 className="font-medium mb-2">{goal.title}</h3>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span>{goal.current} {goal.unit}</span>
                          <span className="text-muted-foreground">Meta: {goal.target} {goal.unit}</span>
                        </div>
                        <Progress value={goal.progress} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>{goal.progress}% completo</span>
                          <span>Prazo: {goal.deadline}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Historical Data */}
          <ScrollReveal delay={500}>
            <Card className="glass-card border-glass-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span>Histórico Mensal</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-5 gap-4">
                    {monthlyStats.map((month, index) => (
                      <div key={index} className="text-center">
                        <div className="text-sm text-muted-foreground mb-2">{month.month}</div>
                        <div className="space-y-2">
                          <div>
                            <div className="text-lg font-bold">{month.workouts}</div>
                            <div className="text-xs text-muted-foreground">Treinos</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-primary">{month.distance}km</div>
                            <div className="text-xs text-muted-foreground">Distância</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-6 pt-6 border-t border-glass-border">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">+18%</div>
                      <div className="text-sm text-muted-foreground">Evolução nos últimos 6 meses</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">156h</div>
                      <div className="text-sm text-muted-foreground">Tempo total de exercício</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">Elite</div>
                      <div className="text-sm text-muted-foreground">Classificação por idade</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
};