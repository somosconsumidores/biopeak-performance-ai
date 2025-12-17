import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  ThumbsUp, 
  ThumbsDown, 
  Target,
  Clock,
  TrendingUp,
  Utensils,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { useWorkoutAIAnalysis, WorkoutAnalysis } from '@/hooks/useWorkoutAIAnalysis';
import { useState, useEffect } from 'react';

interface AIInsightsCardProps {
  activityId: string;
}

export const AIInsightsCard = ({ activityId }: AIInsightsCardProps) => {
  const { analysis, loading, error, analyzeWorkout, forceReanalyze, loadCachedAnalysis } = useWorkoutAIAnalysis();
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);

  // Load stored analysis when component mounts or activityId changes
  useEffect(() => {
    if (activityId) {
      loadCachedAnalysis(activityId);
    }
  }, [activityId, loadCachedAnalysis]);

  const handleAnalyze = () => {
    analyzeWorkout(activityId);
  };

  const handleNewAnalysis = () => {
    forceReanalyze(activityId);
  };

  if (!analysis && !loading && !error) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-primary" />
            <span>Análise Inteligente</span>
            <Badge variant="outline" className="ml-auto">
              <Sparkles className="h-3 w-3 mr-1" />
              IA
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Análise Inteligente Disponível</h3>
          <p className="text-muted-foreground mb-6">
            Nossa IA pode analisar seu treino e fornecer insights personalizados sobre performance, recuperação e próximos passos.
          </p>
          <Button onClick={handleAnalyze} className="w-full">
            <Brain className="h-4 w-4 mr-2" />
            Analisar com IA
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-primary" />
            <span>Análise Inteligente</span>
            <Badge variant="outline" className="ml-auto">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Analisando...
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold mb-2">Analisando seu treino...</h3>
          <p className="text-muted-foreground">
            Nossa IA está processando os dados da sua atividade para gerar insights personalizados.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-primary" />
            <span>Análise Inteligente</span>
            <Badge variant="destructive" className="ml-auto">
              <AlertCircle className="h-3 w-3 mr-1" />
              Erro
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro na Análise</h3>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={handleAnalyze} variant="outline">
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-6">
      {/* Re-analyze Button at Top */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleNewAnalysis} disabled={loading}>
          <Brain className="h-4 w-4 mr-2" />
          Reanalisar
        </Button>
      </div>

      {/* Main AI Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* What Worked */}
        <Card className="glass-card border-glass-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-green-400 text-base sm:text-lg">
              <ThumbsUp className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="truncate">O que Funcionou</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 sm:space-y-3">
              {analysis.whatWorked.map((insight, index) => (
                <div key={index} className="flex items-start space-x-2 sm:space-x-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-400 mt-2 flex-shrink-0" />
                  <p className="text-xs sm:text-sm leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* To Improve */}
        <Card className="glass-card border-glass-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-yellow-400 text-base sm:text-lg">
              <ThumbsDown className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="truncate">Para Melhorar</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 sm:space-y-3">
              {analysis.toImprove.map((insight, index) => (
                <div key={index} className="flex items-start space-x-2 sm:space-x-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-yellow-400 mt-2 flex-shrink-0" />
                  <p className="text-xs sm:text-sm leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="glass-card border-glass-border md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-primary text-base sm:text-lg">
              <Target className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="truncate">Recomendações</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 sm:space-y-3">
              {analysis.recommendations.map((insight, index) => (
                <div key={index} className="flex items-start space-x-2 sm:space-x-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <p className="text-xs sm:text-sm leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis Toggle */}
      <div className="text-center">
        <Button 
          variant="outline" 
          onClick={() => setShowDetailedAnalysis(!showDetailedAnalysis)}
          className="w-full sm:w-auto min-h-[2.5rem] px-6"
        >
          <span className="truncate">{showDetailedAnalysis ? 'Ocultar' : 'Ver'} Análise Detalhada</span>
        </Button>
      </div>

      {/* Detailed Analysis */}
      {showDetailedAnalysis && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Performance Insights */}
          <Card className="glass-card border-glass-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span>Insights de Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2 text-blue-400">Eficiência</h4>
                <p className="text-sm text-muted-foreground">{analysis.performanceInsights.efficiency}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-purple-400">Ritmo</h4>
                <p className="text-sm text-muted-foreground">{analysis.performanceInsights.pacing}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-red-400">Frequência Cardíaca</h4>
                <p className="text-sm text-muted-foreground">{analysis.performanceInsights.heartRateAnalysis}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-green-400">Distribuição do Esforço</h4>
                <p className="text-sm text-muted-foreground">{analysis.performanceInsights.effortDistribution}</p>
              </div>
            </CardContent>
          </Card>

          {/* Recovery Guidance */}
          <Card className="glass-card border-glass-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-primary" />
                <span>Orientações de Recuperação</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2 text-orange-400">Tempo de Recuperação</h4>
                <p className="text-sm text-muted-foreground">{analysis.recoveryGuidance.estimatedRecoveryTime}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-cyan-400">Próximo Treino</h4>
                <p className="text-sm text-muted-foreground">{analysis.recoveryGuidance.nextWorkoutSuggestions}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-emerald-400">Nutrição</h4>
                <p className="text-sm text-muted-foreground">{analysis.recoveryGuidance.nutritionTips}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
};