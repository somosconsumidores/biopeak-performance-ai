import { Activity, TrendingUp, Heart, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useVariationCoefficientAnalysis } from '@/hooks/useVariationCoefficientAnalysis';

interface VariationCoefficientAnalysisProps {
  activityId: string;
}

export const VariationCoefficientAnalysis = ({ activityId }: VariationCoefficientAnalysisProps) => {
  const { analysis, loading, error } = useVariationCoefficientAnalysis(activityId);

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-background to-muted/50 border-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Análise de Variabilidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !analysis || !analysis.diagnosis) {
    return null; // Don't show anything if there's no data
  }

  const getDiagnosisColor = (diagnosis: string) => {
    if (diagnosis.includes('treino contínuo e controlado')) {
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
    } else if (diagnosis.includes('estratégia eficiente')) {
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
    } else if (diagnosis.includes('fadiga, desidratação')) {
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
    } else if (diagnosis.includes('muito variáveis')) {
      return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20';
    }
    return 'bg-muted text-foreground border-border';
  };

  const getDiagnosisIcon = (diagnosis: string) => {
    if (diagnosis.includes('treino contínuo e controlado')) {
      return <Activity className="h-4 w-4" />;
    } else if (diagnosis.includes('estratégia eficiente')) {
      return <Zap className="h-4 w-4" />;
    } else if (diagnosis.includes('fadiga, desidratação')) {
      return <Heart className="h-4 w-4" />;
    } else if (diagnosis.includes('muito variáveis')) {
      return <TrendingUp className="h-4 w-4" />;
    }
    return <Activity className="h-4 w-4" />;
  };

  const getCVBadgeVariant = (level: 'Baixo' | 'Alto' | null) => {
    if (level === 'Baixo') return 'default';
    if (level === 'Alto') return 'secondary';
    return 'outline';
  };

  return (
    <Card className="bg-gradient-to-r from-background to-muted/50 border-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Análise de Variabilidade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CV Metrics */}
        <div className="grid grid-cols-2 gap-4">
          {analysis.heartRateCV !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  CV Frequência Cardíaca
                </span>
                <Badge variant={getCVBadgeVariant(analysis.heartRateCVLevel)} className="text-xs">
                  {analysis.heartRateCVLevel}
                </Badge>
              </div>
              <p className="text-sm font-medium">{analysis.heartRateCV.toFixed(1)}%</p>
            </div>
          )}
          
          {analysis.paceCV !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  CV Pace
                </span>
                <Badge variant={getCVBadgeVariant(analysis.paceCVLevel)} className="text-xs">
                  {analysis.paceCVLevel}
                </Badge>
              </div>
              <p className="text-sm font-medium">{analysis.paceCV.toFixed(1)}%</p>
            </div>
          )}
        </div>

        {/* Diagnosis */}
        {analysis.diagnosis && (
          <div className={`p-3 rounded-lg border ${getDiagnosisColor(analysis.diagnosis)}`}>
            <div className="flex items-start gap-2">
              {getDiagnosisIcon(analysis.diagnosis)}
              <p className="text-sm font-medium leading-relaxed">
                {analysis.diagnosis}
              </p>
            </div>
          </div>
        )}

        {/* Info tooltip */}
        <p className="text-xs text-muted-foreground">
          Coeficiente de Variação (CV) = Desvio Padrão / Média × 100. CV ≤ 15% = Baixa variabilidade
        </p>
      </CardContent>
    </Card>
  );
};