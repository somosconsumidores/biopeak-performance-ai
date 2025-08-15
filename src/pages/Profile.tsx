import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { useProfileStats } from '@/hooks/useProfileStats';
import { useOnboarding } from '@/hooks/useOnboarding';
import { 
  Settings, 
  Target,
  Trophy,
  Calendar,
  Activity,
  Heart,
  BarChart3,
  Edit,
  Star,
  TrendingUp,
  Award,
  Clock,
  Flame,
  Loader
} from 'lucide-react';

export const Profile = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading, age } = useProfile();
  const { onboardingData } = useOnboarding();
  const { 
    stats, 
    personalBests, 
    loading: statsLoading, 
    formatDistance, 
    formatDuration, 
    formatPace 
  } = useProfileStats();

  const isLoading = profileLoading || statsLoading;

  // Calcular nível de performance baseado nas atividades
  const calculatePerformanceLevel = () => {
    if (!stats) return { overall: 0, cardiovascular: 0, strength: 0, endurance: 0, recovery: 0 };
    
    // Algoritmo simplificado baseado nos dados disponíveis
    const totalActivities = stats.totalActivities;
    const avgWeekly = stats.avgWeeklyActivities;
    const hasGoodPace = stats.bestPace > 0 && stats.bestPace < 6; // pace melhor que 6 min/km
    const hasGoodHR = stats.avgHeartRate > 120 && stats.avgHeartRate < 160;
    
    let overall = Math.min(90, Math.max(20, 
      (totalActivities / 10) * 10 + // até 50 pontos por atividades
      (avgWeekly * 8) + // até 32 pontos por frequência
      (hasGoodPace ? 15 : 0) + // 15 pontos por bom pace
      (hasGoodHR ? 15 : 0) // 15 pontos por boa FC
    ));
    
    return {
      overall: Math.round(overall),
      cardiovascular: Math.round(overall * 1.1), // FC indica cardiovascular
      strength: Math.round(overall * 0.8), // Força estimada menor
      endurance: Math.round(overall * 0.95), // Resistência baseada em distância
      recovery: Math.round(overall * 0.9) // Recuperação estimada
    };
  };

  const performanceLevel = calculatePerformanceLevel();

  // Achievements baseados em dados reais
  const achievements = [
    { 
      title: 'Primeiro Passo', 
      description: 'Primeira atividade sincronizada',
      icon: Star,
      color: 'text-yellow-400',
      completed: (stats?.totalActivities || 0) > 0,
      date: stats?.memberSince || null
    },
    { 
      title: 'Consistência', 
      description: 'Sequência de 7 dias',
      icon: Trophy,
      color: 'text-blue-400',
      completed: (stats?.currentStreak || 0) >= 7,
      date: null
    },
    { 
      title: 'Maratonista', 
      description: 'Completar 42.2km em uma atividade',
      icon: Target,
      color: 'text-purple-400',
      completed: (stats?.totalDistance || 0) >= 42200,
      date: null
    },
    { 
      title: 'Atleta Ativo', 
      description: 'Completar 50 atividades',
      icon: Activity,
      color: 'text-green-400',
      completed: (stats?.totalActivities || 0) >= 50,
      progress: Math.min(100, ((stats?.totalActivities || 0) / 50) * 100)
    },
    { 
      title: '10K Runner', 
      description: 'Completar 10km em uma corrida',
      icon: Target,
      color: 'text-orange-400',
      completed: (stats?.avgDistance || 0) >= 10000,
      date: null
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        
        <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="flex items-center justify-center h-64">
              <Loader className="h-8 w-8 animate-spin text-primary" />
            </div>
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
          {/* Profile Header */}
          <ScrollReveal>
            <Card className="glass-card border-glass-border mb-8">
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
                  <div className="relative">
                    <Avatar className="w-24 h-24">
                      <AvatarImage src={profile?.avatar_url || ''} />
                      <AvatarFallback className="text-2xl font-bold bg-gradient-primary text-white">
                        {profile?.display_name?.split(' ').map(n => n[0]).join('') || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div>
                      <h1 className="text-3xl font-bold">
                        {profile?.display_name || 'Usuário'}
                      </h1>
                      <p className="text-muted-foreground">{profile?.email}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                        {age && <span>{age} anos</span>}
                        {age && profile?.weight_kg && <span>•</span>}
                        {profile?.weight_kg && <span>{profile.weight_kg}kg</span>}
                        {profile?.weight_kg && profile?.height_cm && <span>•</span>}
                        {profile?.height_cm && <span>{profile.height_cm}cm</span>}
                        {stats?.memberSince && (
                          <>
                            <span>•</span>
                            <span>Membro desde {new Date(stats.memberSince).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{stats?.totalActivities || 0}</div>
                        <div className="text-xs text-muted-foreground">Total Atividades</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {stats ? formatDistance(stats.totalDistance) : '0 km'}
                        </div>
                        <div className="text-xs text-muted-foreground">Distância Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {stats?.avgWeeklyActivities || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Atividades/Semana</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{stats?.currentStreak || 0}</div>
                        <div className="text-xs text-muted-foreground">Sequência Atual</div>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    className="btn-primary"
                    onClick={() => navigate('/profile/edit')}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Editar Perfil
                  </Button>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Goals & Athletic Level */}
          {onboardingData && (
            <ScrollReveal delay={50}>
              <Card className="glass-card border-glass-border mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-primary" />
                    <span>Seu Perfil Atlético</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-lg mb-2 flex items-center">
                          <Target className="h-5 w-5 text-primary mr-2" />
                          Objetivo Principal
                        </h3>
                        <div className="p-4 glass-card rounded-lg">
                          <p className="text-foreground">
                            {onboardingData.goal === 'fitness' && 'Melhorar meu condicionamento físico'}
                            {onboardingData.goal === 'analysis' && 'Analisar os meus treinos'}
                            {onboardingData.goal === 'weight_loss' && 'Perder peso'}
                            {onboardingData.goal === 'general_training' && 'Treinamento em geral'}
                            {onboardingData.goal === 'improve_times' && 'Melhorar minhas marcas'}
                            {onboardingData.goal === 'specific_goal' && 'Treinar para um objetivo específico'}
                            {onboardingData.goal === 'lifestyle' && 'Mudar meus hábitos de vida'}
                            {onboardingData.goal === 'other' && (onboardingData.goal_other || 'Outros')}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-lg mb-2 flex items-center">
                          <Trophy className="h-5 w-5 text-primary mr-2" />
                          Nível Atlético
                        </h3>
                        <div className="p-4 glass-card rounded-lg">
                          <div className="flex items-center space-x-3">
                            {onboardingData.athletic_level === 'beginner' && (
                              <>
                                <Star className="h-6 w-6 text-yellow-400" />
                                <div>
                                  <p className="font-medium">Iniciante</p>
                                  <p className="text-sm text-muted-foreground">Começando minha vida atlética</p>
                                </div>
                              </>
                            )}
                            {onboardingData.athletic_level === 'intermediate' && (
                              <>
                                <Activity className="h-6 w-6 text-blue-400" />
                                <div>
                                  <p className="font-medium">Intermediário</p>
                                  <p className="text-sm text-muted-foreground">Me exercito sem frequência específica</p>
                                </div>
                              </>
                            )}
                            {onboardingData.athletic_level === 'advanced' && (
                              <>
                                <Trophy className="h-6 w-6 text-green-400" />
                                <div>
                                  <p className="font-medium">Avançado</p>
                                  <p className="text-sm text-muted-foreground">Me exercito frequentemente</p>
                                </div>
                              </>
                            )}
                            {onboardingData.athletic_level === 'elite' && (
                              <>
                                <Award className="h-6 w-6 text-purple-400" />
                                <div>
                                  <p className="font-medium">Elite</p>
                                  <p className="text-sm text-muted-foreground">Participo de competições</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          )}

          {/* Performance Level */}
          <ScrollReveal delay={100}>
            <Card className="glass-card border-glass-border mb-8">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <span>Nível de Performance</span>
                  <Badge variant="default" className="ml-auto">
                    Nível {Math.floor(performanceLevel.overall / 20)} - {
                      performanceLevel.overall >= 80 ? 'Elite' :
                      performanceLevel.overall >= 60 ? 'Avançado' :
                      performanceLevel.overall >= 40 ? 'Intermediário' :
                      'Iniciante'
                    }
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-5 gap-6">
                  {Object.entries(performanceLevel).map(([key, value]) => (
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
                    {personalBests && personalBests.length > 0 ? (
                      personalBests.map((record, index) => (
                        <div key={index} className="flex items-center justify-between p-4 glass-card rounded-lg">
                          <div>
                            <div className="font-medium">{record.metric}</div>
                            <div className="text-sm text-muted-foreground">{record.date}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">{record.value}</div>
                            <div className="text-sm text-muted-foreground">{record.activityType}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Sincronize mais atividades para ver seus recordes</p>
                      </div>
                    )}
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
                          {!achievement.completed && achievement.progress !== undefined && (
                            <div className="mt-2">
                              <Progress value={achievement.progress} className="h-1" />
                              <div className="text-xs text-muted-foreground mt-1">{Math.round(achievement.progress)}% completo</div>
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

          {/* Activity Summary */}
          <ScrollReveal delay={400}>
            <Card className="glass-card border-glass-border mb-8">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <span>Resumo de Atividades</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {stats ? formatDuration(stats.totalDuration) : '0m'}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center justify-center">
                      <Clock className="h-4 w-4 mr-1" />
                      Tempo Total
                    </div>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {stats?.totalCalories || 0}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center justify-center">
                      <Flame className="h-4 w-4 mr-1" />
                      Calorias Queimadas
                    </div>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {stats?.avgHeartRate || 0} bpm
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center justify-center">
                      <Heart className="h-4 w-4 mr-1" />
                      FC Média
                    </div>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {stats ? formatPace(stats.avgPace) : 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Pace Médio
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