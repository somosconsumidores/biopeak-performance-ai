import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  MapPin, 
  TrendingUp, 
  TrendingDown, 
  Heart, 
  Zap, 
  BarChart3, 
  Brain,
  Target,
  AlertCircle,
  Sparkles,
  Activity,
  Crown,
  Lock
} from 'lucide-react';
import { useWorkoutComparison, type ActivityComparison } from '@/hooks/useWorkoutComparison';
import { useSubscription } from '@/hooks/useSubscription';
import { useAnalysisPurchases } from '@/hooks/useAnalysisPurchases';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface WorkoutAIAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: string | null;
}

export const WorkoutAIAnalysisDialog: React.FC<WorkoutAIAnalysisDialogProps> = ({
  open,
  onOpenChange,
  activityId
}) => {
  const { comparison, loading, error, analyzeWorkout } = useWorkoutComparison();
  const { isSubscribed, loading: subscriptionLoading } = useSubscription();
  const { hasPurchased, loading: purchaseCheckLoading } = useAnalysisPurchases(activityId);
  const navigate = useNavigate();
  const [purchaseLoading, setPurchaseLoading] = React.useState(false);

  const canAccessAnalysis = isSubscribed || hasPurchased;

  React.useEffect(() => {
    if (open && activityId && !comparison && !loading && !subscriptionLoading && !purchaseCheckLoading && canAccessAnalysis) {
      analyzeWorkout(activityId);
    }
  }, [open, activityId, comparison, loading, subscriptionLoading, purchaseCheckLoading, canAccessAnalysis, analyzeWorkout]);

  const handlePurchaseAnalysis = async () => {
    if (!activityId) return;

    setPurchaseLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-single-analysis-payment', {
        body: { 
          activityId,
          activitySource: 'strava' // Default to strava for now
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Redirecionando para pagamento",
          description: "Você será redirecionado para o Stripe para concluir a compra.",
        });
      }
    } catch (err) {
      console.error('Error purchasing analysis:', err);
      toast({
        title: "Erro ao processar pagamento",
        description: err instanceof Error ? err.message : "Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setPurchaseLoading(false);
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '--';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours > 0) {
      return `${hours}h${mins.toString().padStart(2, '0')}m`;
    }
    return `${mins}m`;
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

  const formatPercentChange = (value: number | null) => {
    if (value === null) return '--';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const ComparisonMetric = ({ 
    icon: Icon, 
    label, 
    current, 
    historical, 
    percentChange, 
    isImprovement,
    formatter 
  }: {
    icon: any;
    label: string;
    current: number | null;
    historical: number | null;
    percentChange: number | null;
    isImprovement: boolean | null;
    formatter: (value: number | null) => string;
  }) => (
    <Card className="glass-card border-glass-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Icon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{label}</span>
          </div>
          {isImprovement !== null && (
            <Badge variant={isImprovement ? "default" : "secondary"}>
              {isImprovement ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {formatPercentChange(percentChange)}
            </Badge>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Atual:</span>
            <span className="font-bold text-lg">{formatter(current)}</span>
          </div>
          
          {historical !== null && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Média histórica:</span>
              <span className="text-sm text-muted-foreground">{formatter(historical)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background border">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>Análise de seu treino com IA</span>
          </DialogTitle>
        </DialogHeader>

        {(subscriptionLoading || purchaseCheckLoading) && (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              {subscriptionLoading ? 'Verificando sua assinatura...' : 'Verificando compras...'}
            </p>
          </div>
        )}

        {!subscriptionLoading && !purchaseCheckLoading && !canAccessAnalysis && (
          <Card className="glass-card border-glass-border">
            <CardContent className="py-12 text-center">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <Crown className="h-16 w-16 text-yellow-500" />
                  <Lock className="h-6 w-6 text-muted-foreground absolute -bottom-1 -right-1 bg-background rounded-full p-1" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold mb-3">Funcionalidade Premium</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                A análise de treino com IA é uma funcionalidade exclusiva para assinantes. 
                Obtenha insights personalizados, comparações históricas e recomendações inteligentes para seus treinos.
              </p>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-center space-x-2 text-sm">
                  <Brain className="h-4 w-4 text-primary" />
                  <span>Análise de performance com IA</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span>Comparações com histórico dos últimos 30 dias</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-sm">
                  <Target className="h-4 w-4 text-primary" />
                  <span>Recomendações personalizadas de treino</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-sm">
                  <Zap className="h-4 w-4 text-primary" />
                  <span>Orientações de recovery inteligentes</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  onClick={() => navigate('/paywall')}
                  className="min-w-[140px]"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Assinar Agora
                </Button>
                <Button 
                  onClick={handlePurchaseAnalysis}
                  disabled={purchaseLoading}
                  className="min-w-[140px] bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                >
                  {purchaseLoading ? 'Processando...' : 'Compre esta Análise por R$ 4,99'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="min-w-[140px]"
                >
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!subscriptionLoading && !purchaseCheckLoading && canAccessAnalysis && loading && (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Analisando seu treino com IA...</p>
            <p className="text-xs text-muted-foreground mt-2">
              Comparando com histórico e gerando recomendações personalizadas
            </p>
          </div>
        )}

        {!subscriptionLoading && !purchaseCheckLoading && canAccessAnalysis && error && (
          <Card className="glass-card border-glass-border">
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Erro na Análise</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button 
                onClick={() => activityId && analyzeWorkout(activityId)}
                variant="outline"
              >
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {!subscriptionLoading && !purchaseCheckLoading && canAccessAnalysis && comparison && (
          <div className="space-y-6">
            {/* Activity Overview */}
            <Card className="glass-card border-glass-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <span>Resumo da Atividade</span>
                  <Badge variant="outline">{comparison.currentActivity.classifiedType}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-4">
                  {comparison.historicalStats.totalActivities > 0 ? (
                    <span>
                      Comparação baseada em {comparison.historicalStats.totalActivities} atividade(s) similares dos últimos 30 dias
                    </span>
                  ) : (
                    <span>Primeira atividade deste tipo nos últimos 30 dias</span>
                  )}
                </div>

                {/* Comparison Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <ComparisonMetric
                    icon={Clock}
                    label="Duração"
                    current={comparison.comparisons.duration.current}
                    historical={comparison.comparisons.duration.historical}
                    percentChange={comparison.comparisons.duration.percentChange}
                    isImprovement={comparison.comparisons.duration.isImprovement}
                    formatter={formatDuration}
                  />

                  <ComparisonMetric
                    icon={MapPin}
                    label="Distância"
                    current={comparison.comparisons.distance.current}
                    historical={comparison.comparisons.distance.historical}
                    percentChange={comparison.comparisons.distance.percentChange}
                    isImprovement={comparison.comparisons.distance.isImprovement}
                    formatter={formatDistance}
                  />

                  <ComparisonMetric
                    icon={TrendingUp}
                    label="Pace Médio"
                    current={comparison.comparisons.pace.current}
                    historical={comparison.comparisons.pace.historical}
                    percentChange={comparison.comparisons.pace.percentChange}
                    isImprovement={comparison.comparisons.pace.isImprovement}
                    formatter={formatPace}
                  />

                  <ComparisonMetric
                    icon={Heart}
                    label="FC Média"
                    current={comparison.comparisons.heartRate.current}
                    historical={comparison.comparisons.heartRate.historical}
                    percentChange={comparison.comparisons.heartRate.percentChange}
                    isImprovement={comparison.comparisons.heartRate.isImprovement}
                    formatter={(value) => value ? `${Math.round(value)} bpm` : '--'}
                  />
                </div>
              </CardContent>
            </Card>

            {/* AI Recommendations */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Performance Analysis */}
              <Card className="glass-card border-glass-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <span>Análise de Performance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {comparison.aiRecommendations.performanceAnalysis.map((analysis, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <p className="text-sm">{analysis}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Strengths & Areas to Improve */}
              <div className="space-y-4">
                <Card className="glass-card border-glass-border">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-green-400" />
                      <span>Pontos Fortes</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {comparison.aiRecommendations.strengths.map((strength, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 flex-shrink-0" />
                          <p className="text-sm">{strength}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card border-glass-border">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="h-5 w-5 text-yellow-400" />
                      <span>Áreas para Melhorar</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {comparison.aiRecommendations.areasToImprove.map((area, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-2 flex-shrink-0" />
                          <p className="text-sm">{area}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Recommendations & Recovery */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="glass-card border-glass-border">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Brain className="h-5 w-5 text-primary" />
                      <span>Recomendações IA</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {comparison.aiRecommendations.recommendations.map((recommendation, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <Badge variant="outline" className="mt-0.5 flex-shrink-0">
                            {index + 1}
                          </Badge>
                          <p className="text-sm">{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="glass-card border-glass-border">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Zap className="h-5 w-5 text-orange-400" />
                      <span>Recovery</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{comparison.aiRecommendations.recoveryGuidance}</p>
                  </CardContent>
                </Card>

                <Card className="glass-card border-glass-border">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="h-5 w-5 text-primary" />
                      <span>Próximo Treino</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{comparison.aiRecommendations.nextWorkoutSuggestions}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};