import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Heart, Target, BarChart3, AlertCircle } from 'lucide-react';
import { useVariationAnalysis } from '@/hooks/useVariationAnalysis';
import type { UnifiedActivity } from '@/hooks/useUnifiedActivityHistory';

interface VariationAnalysisCardProps {
  activity: UnifiedActivity;
}

export const VariationAnalysisCard = ({ activity }: VariationAnalysisCardProps) => {
  const { analysis, loading, error } = useVariationAnalysis(activity);

  if (loading) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Análise de Variação</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-3"></div>
            <span className="text-muted-foreground">Calculando coeficientes de variação...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Análise de Variação</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex items-center text-destructive">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Erro ao calcular análise: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis || !analysis.hasValidData) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Análise de Variação</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex items-center text-muted-foreground">
            <AlertCircle className="h-5 w-5 mr-2" />
            <div>
              <p>{analysis?.diagnosis || 'Dados insuficientes para análise'}</p>
              {analysis && (
                <p className="text-xs mt-1">
                  Pontos de dados: {analysis.dataPoints} (mínimo necessário: 10)
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCVBadgeClass = (category: 'Baixo' | 'Alto') => {
    if (category === 'Baixo') {
      return 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600';
    } else {
      return 'bg-red-600 hover:bg-red-700 text-white border-red-600';
    }
  };

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span>Análise de Variação</span>
          <Badge variant="outline" className="text-xs">
            {analysis.dataPoints} pontos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Coeficientes de Variação */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50">
            <div className="flex items-center space-x-3">
              <Heart className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Variação FC</p>
                <p className="text-sm text-muted-foreground">
                  CV: {(analysis.heartRateCV * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <Badge 
              className={getCVBadgeClass(analysis.heartRateCVCategory)}
            >
              {analysis.heartRateCVCategory}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Variação Pace</p>
                <p className="text-sm text-muted-foreground">
                  CV: {(analysis.paceCV * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <Badge 
              className={getCVBadgeClass(analysis.paceCVCategory)}
            >
              {analysis.paceCVCategory}
            </Badge>
          </div>
        </div>

        {/* Diagnóstico */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-start space-x-3">
            <Target className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-primary mb-1">Diagnóstico da Atividade</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {analysis.diagnosis}
              </p>
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="text-xs text-muted-foreground border-t border-border/50 pt-4">
          <p className="mb-1">
            <strong>Coeficiente de Variação (CV):</strong> Medida de variabilidade relativa
          </p>
          <p>
            <strong>Baixo ≤ 15%</strong> | <strong>Alto {'>'} 15%</strong>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};