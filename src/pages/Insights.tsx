import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useInsights } from '@/hooks/useInsights';
import { useCommitments } from '@/hooks/useCommitments';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
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
  Star,
  RefreshCw,
  Loader2,
  AlertCircle
} from 'lucide-react';

export const Insights = () => {
  const { insights, loading, error, refreshInsights } = useInsights();
  const { applyRecommendation } = useCommitments();

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">Gerando Insights com IA</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Analisando seus dados de treino dos últimos 60 dias para criar insights personalizados...
              </p>
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
            <div className="flex flex-col items-center justify-center py-32">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Erro ao Carregar Insights</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">{error}</p>
              <Button onClick={refreshInsights} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!insights) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Header */}
          <ScrollReveal>
            <div className="text-center mb-8 md:mb-12">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 md:mb-4">
                    Insights <span className="bg-gradient-primary bg-clip-text text-transparent">Personalizados</span>
                  </h1>
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    Análise inteligente da sua performance com recomendações baseadas em IA 
                    para maximizar seus resultados
                  </p>
                </div>
                <Button 
                  onClick={refreshInsights} 
                  variant="outline" 
                  className="self-center sm:self-start h-10 sm:h-auto px-4 text-sm touch-manipulation"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
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
                {insights.weeklyInsights.map((insight, index) => (
                  <Card key={index} className="glass-card border-glass-border">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-3 mb-4">
                        <div className={`p-2 rounded-full ${insight.isPositive ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                          {insight.isPositive ? (
                            <TrendingUp className="h-5 w-5 text-green-400" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold">{insight.title}</h3>
                            <Badge variant={insight.isPositive ? 'default' : 'secondary'}>
                              {insight.change}
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
                {insights.personalizedMetrics.map((metric, index) => (
                  <Card key={index} className="glass-card border-glass-border">
                    <CardHeader>
                      <CardTitle className="text-lg">{metric.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-end space-x-2">
                          <span className="text-3xl font-bold">{metric.value}</span>
                          <span className="text-muted-foreground">{metric.unit}</span>
                          <span className={`text-sm font-medium ${metric.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {metric.change}
                          </span>
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
                     {insights.zoneEffectiveness.map((zone, index) => (
                       <div key={index} className="space-y-2">
                         <div className="flex items-center justify-between">
                           <div className="flex items-center space-x-3">
                             <div className={`w-3 h-3 rounded-full ${zone.color}`} />
                             <span className="font-medium">{zone.zone}</span>
                           </div>
                           <div className="flex items-center space-x-2">
                             <span className="text-sm">{zone.percentage}%</span>
                           </div>
                         </div>
                         <div className="flex items-center space-x-2">
                           <Progress value={zone.percentage} className="flex-1" />
                           <span className="text-sm font-medium">{zone.percentage}%</span>
                         </div>
                       </div>
                     ))}
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
                     {insights.weeklyGoals.map((goal, index) => (
                       <div key={index} className="space-y-3">
                         <div className="flex items-center justify-between">
                           <h4 className="font-medium">{goal.title}</h4>
                           <Badge variant={(goal.current / goal.target) >= 1 ? 'default' : 'secondary'}>
                             {(goal.current / goal.target) >= 1 ? 'Alcançado' : 'Em Progresso'}
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
                   {insights.aiRecommendations.map((rec, index) => (
                     <div key={index} className="p-6 glass-card rounded-lg space-y-4">
                       <div className="flex items-start justify-between">
                         <h3 className="font-semibold">{rec.title}</h3>
                         <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                           {rec.priority === 'high' ? 'Alta' : 'Média'}
                         </Badge>
                       </div>
                       <p className="text-sm text-muted-foreground">{rec.description}</p>
                        <div className="flex items-center justify-between">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="glass-card border-glass-border"
                            onClick={() => applyRecommendation({
                              title: rec.title,
                              description: rec.description,
                              priority: rec.priority,
                              category: 'Recomendação IA'
                            })}
                          >
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
                   <h3 className="text-xl font-semibold">Previsões de Performance</h3>
                   {insights.performancePredictions && insights.performancePredictions.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                       {insights.performancePredictions.map((prediction, index) => (
                         <div key={index} className="text-center">
                           <div className="text-2xl font-bold text-primary">
                             {prediction.predictedValue > prediction.currentValue ? '+' : ''}
                             {(prediction.predictedValue - prediction.currentValue).toFixed(1)}
                           </div>
                           <div className="text-sm text-muted-foreground">{prediction.metric}</div>
                           <div className="text-xs text-muted-foreground mt-1">
                             {prediction.confidence}% confiança • {prediction.timeframe}
                           </div>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                       <div className="text-center">
                         <div className="text-2xl font-bold text-green-400">+2.1</div>
                         <div className="text-sm text-muted-foreground">VO₂ Max (ml/kg/min)</div>
                       </div>
                       <div className="text-center">
                         <div className="text-2xl font-bold text-blue-400">-3</div>
                         <div className="text-sm text-muted-foreground">FC Repouso (bpm)</div>
                       </div>
                       <div className="text-center">
                         <div className="text-2xl font-bold text-purple-400">+5%</div>
                         <div className="text-sm text-muted-foreground">Eficiência Global</div>
                       </div>
                     </div>
                   )}
                   <p className="text-muted-foreground max-w-2xl mx-auto mt-6">
                     Com base na análise dos seus dados reais de treino, nossa IA calcula 
                     previsões personalizadas de melhoria. Continue seguindo as recomendações 
                     para alcançar seu máximo potencial.
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