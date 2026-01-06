import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useInsights } from '@/hooks/useInsights';
import { useCommitments } from '@/hooks/useCommitments';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useSubscription } from '@/hooks/useSubscription';
import { usePlatform } from '@/hooks/usePlatform';
import { useNavigate } from 'react-router-dom';
import TrainingRecommendationsCard from '@/components/TrainingRecommendationsCard';
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
  AlertCircle,
  ShieldAlert,
  Info
} from 'lucide-react';

export const Insights = () => {
  const { insights, loading, error, refreshInsights } = useInsights();
  const { applyRecommendation } = useCommitments();
  const { overtrainingRisk, loading: dashboardLoading } = useDashboardMetrics();
  const { isNative } = usePlatform();

  console.log('🔍 INSIGHTS PAGE DEBUG:', { insights, loading, error });

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        {isNative && <Header />}
        <div className={`pb-12 px-4 sm:px-6 lg:px-8 ${isNative ? 'pt-24' : 'pt-8'}`}>
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
        {isNative && <Header />}
        <div className={`pb-12 px-4 sm:px-6 lg:px-8 ${isNative ? 'pt-24' : 'pt-8'}`}>
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
    <ProtectedRoute>
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        {isNative && <Header />}
        
        <div className={`pb-8 sm:pb-12 px-3 sm:px-4 md:px-6 lg:px-8 ${isNative ? 'safe-pt-20 sm:safe-pt-24' : 'pt-6'}`}>
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
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          
          {/* Weekly Insights */}
          <ScrollReveal>
            <div className="mb-8 md:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold mb-6 text-foreground">
                Insights da Semana
              </h2>
              <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
                {insights.weeklyInsights.map((insight, index) => (
                  <div key={index} className="glass-card border-glass-border p-4 md:p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-sm md:text-base text-foreground">
                        {insight.title}
                      </h3>
                      <Badge 
                        variant={insight.isPositive ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {insight.change}
                      </Badge>
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                      {insight.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Personalized Metrics */}
          <ScrollReveal>
            <div className="mb-8 md:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold mb-6 text-foreground">
                Métricas Personalizadas
              </h2>
              <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {insights.personalizedMetrics.map((metric, index) => (
                  <div key={index} className="glass-card border-glass-border p-4 md:p-6 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Heart className="h-5 w-5 mr-2 text-primary" />
                      <span className="text-sm text-muted-foreground">{metric.label}</span>
                    </div>
                    <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                      {metric.value}
                      <span className="text-sm text-muted-foreground ml-1">{metric.unit}</span>
                    </div>
                    <Badge 
                      variant={metric.isPositive ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {metric.change}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Zone Effectiveness */}
          <ScrollReveal>
            <div className="mb-8 md:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold mb-6 text-foreground">
                Efetividade por Zona
              </h2>
              <div className="glass-card border-glass-border p-4 md:p-6">
                <div className="space-y-4">
                  {insights.zoneEffectiveness.map((zone, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{zone.zone}</span>
                      <div className="flex items-center gap-3">
                        <Progress value={zone.percentage} className="w-24 md:w-32 h-2" />
                        <span className="text-sm font-semibold text-foreground min-w-10">
                          {zone.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Weekly Goals */}
          <ScrollReveal>
            <div className="mb-8 md:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold mb-6 text-foreground">
                Metas Semanais
              </h2>
              <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {insights.weeklyGoals.map((goal, index) => (
                  <div key={index} className="glass-card border-glass-border p-4 md:p-6">
                    <div className="flex items-center justify-between mb-3">
                      <Target className="h-5 w-5 text-primary" />
                      <Badge variant="outline" className="text-xs">
                        {Math.round((goal.current / goal.target) * 100)}%
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-sm md:text-base text-foreground mb-2">
                      {goal.title}
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Atual: {goal.current} {goal.unit}</span>
                        <span>Meta: {goal.target} {goal.unit}</span>
                      </div>
                      <Progress 
                        value={(goal.current / goal.target) * 100} 
                        className="h-2" 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* AI Recommendations */}
          <ScrollReveal>
            <div className="mb-8 md:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold mb-6 text-foreground flex items-center gap-2">
                <Brain className="h-6 w-6 text-primary" />
                Recomendações da IA
              </h2>
              <div className="space-y-4">
                {insights.aiRecommendations.map((rec, index) => (
                  <div key={index} className="glass-card border-glass-border p-4 md:p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <h3 className="font-semibold text-sm md:text-base text-foreground">
                          {rec.title}
                        </h3>
                      </div>
                      <Badge 
                        variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Média' : 'Baixa'}
                      </Badge>
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                      {rec.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Performance Predictions */}
          <ScrollReveal>
            <div className="mb-8 md:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold mb-6 text-foreground flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                Previsões de Performance
              </h2>
              <div className="grid gap-4 md:gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {insights.performancePredictions.map((pred, index) => (
                  <div key={index} className="glass-card border-glass-border p-4 md:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-sm md:text-base text-foreground">
                        {pred.metric}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {pred.confidence}% confiança
                      </Badge>
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
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

        </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};