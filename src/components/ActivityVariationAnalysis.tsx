import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TrendingUp, Heart, Target, BarChart3, AlertCircle, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

interface VariationAnalysisResult {
  paceCV: number;
  heartRateCV: number;
  paceCVCategory: 'Baixo' | 'Alto';
  heartRateCVCategory: 'Baixo' | 'Alto';
  diagnosis: string;
  hasValidData: boolean;
  dataPoints: number;
  activitySource: string;
}

interface ActivityVariationAnalysisProps {
  activityId?: string | null;
}

export const ActivityVariationAnalysis = ({ activityId }: ActivityVariationAnalysisProps) => {
  const [analysis, setAnalysis] = useState<VariationAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateVariationFromChartData = async () => {
    if (!activityId?.trim()) {
      setAnalysis(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      // Buscar dados do activity_chart_data
      const { data: chartData, error: chartError } = await supabase
        .from('activity_chart_data')
        .select('series_data, activity_source, data_points_count')
        .eq('activity_id', activityId!.trim())
        .single();

      if (chartError) {
        throw new Error(`Atividade não encontrada em activity_chart_data: ${chartError.message}`);
      }

      if (!chartData?.series_data || !Array.isArray(chartData.series_data)) {
        throw new Error('Dados de série não encontrados ou inválidos');
      }

      const seriesData = chartData.series_data;
      
      if (seriesData.length < 10) {
        setAnalysis({
          paceCV: 0,
          heartRateCV: 0,
          paceCVCategory: 'Baixo',
          heartRateCVCategory: 'Baixo',
          diagnosis: 'Dados insuficientes para análise (mínimo 10 pontos)',
          hasValidData: false,
          dataPoints: seriesData.length,
          activitySource: chartData.activity_source
        });
        setLoading(false);
        return;
      }

      // Extrair heart rate e pace dos dados
      const heartRates: number[] = [];
      const paces: number[] = [];

      seriesData.forEach((point: any) => {
        // Heart rate pode estar em heart_rate ou hr
        const hr = point.heart_rate || point.hr;
        if (typeof hr === 'number' && hr > 0) {
          heartRates.push(hr);
        }

        // Pace em pace_min_km
        const pace = point.pace_min_km;
        if (typeof pace === 'number' && pace > 0 && pace < 60) { // pace razoável (menos de 60 min/km)
          paces.push(pace);
        }
      });

      if (heartRates.length < 10 && paces.length < 10) {
        setAnalysis({
          paceCV: 0,
          heartRateCV: 0,
          paceCVCategory: 'Baixo',
          heartRateCVCategory: 'Baixo',
          diagnosis: 'Dados de FC e pace insuficientes para análise',
          hasValidData: false,
          dataPoints: seriesData.length,
          activitySource: chartData.activity_source
        });
        setLoading(false);
        return;
      }

      // Calcular coeficientes de variação
      let heartRateCV = 0;
      let paceCV = 0;

      if (heartRates.length >= 10) {
        const avgHR = heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length;
        const hrVariance = heartRates.reduce((sum, hr) => sum + Math.pow(hr - avgHR, 2), 0) / heartRates.length;
        const hrStdDev = Math.sqrt(hrVariance);
        heartRateCV = hrStdDev / avgHR;
      }

      if (paces.length >= 10) {
        const avgPace = paces.reduce((sum, pace) => sum + pace, 0) / paces.length;
        const paceVariance = paces.reduce((sum, pace) => sum + Math.pow(pace - avgPace, 2), 0) / paces.length;
        const paceStdDev = Math.sqrt(paceVariance);
        paceCV = paceStdDev / avgPace;
      }

      // Categorizar CVs com thresholds mais granulares
      const heartRateCVCategory: 'Baixo' | 'Alto' = heartRateCV <= 0.15 ? 'Baixo' : 'Alto';
      const paceCVCategory: 'Baixo' | 'Alto' = paceCV <= 0.30 ? 'Baixo' : 'Alto';

      // Determinar diagnóstico com análise inteligente e contextual
      let diagnosis = '';
      
      if (heartRates.length < 10) {
        diagnosis = 'Análise baseada apenas no pace (dados de FC insuficientes)';
      } else if (paces.length < 10) {
        diagnosis = 'Análise baseada apenas na FC (dados de pace insuficientes)';
      } else {
        // Análise considerando a combinação dos CVs e magnitude
        if (paceCV > 0.50 && heartRateCV < 0.20) {
          diagnosis = '🎯 **Ótimo condicionamento cardiovascular!** Grande variação de ritmo com FC estável indica controle eficiente e boa adaptação aeróbica. Típico de treinos intervalados/fartlek bem executados.';
        } else if (paceCV > 0.30 && heartRateCV < 0.25) {
          diagnosis = '💪 **Treino estruturado com variações.** Ritmo variável com resposta cardiovascular controlada sugere treino intervalado ou fartlek bem planejado. Sistema cardiovascular respondendo adequadamente aos estímulos.';
        } else if (paceCV < 0.15 && heartRateCV < 0.15) {
          diagnosis = '📊 **Treino contínuo e estável.** Ritmo e esforço consistentes caracterizam corrida em estado estacionário (steady state). Ideal para base aeróbica e corridas longas.';
        } else if (paceCV < 0.20 && heartRateCV > 0.25) {
          diagnosis = '⚠️ **FC instável com ritmo constante.** Pode indicar fadiga acumulada, desidratação, condições climáticas adversas ou necessidade de melhor condicionamento aeróbico. Monitore recuperação.';
        } else if (paceCV > 0.30 && heartRateCV > 0.25) {
          diagnosis = '🔄 **Alta variabilidade em ritmo e FC.** Se intencional (intervalado/fartlek), indica treino de qualidade com estímulos variados. Se não intencional, considere melhorar controle de ritmo e pacing.';
        } else {
          diagnosis = '✅ **Variação moderada.** Combinação equilibrada de variações de ritmo e resposta cardiovascular. Treino com mix de intensidades ou transições controladas entre zonas.';
        }
      }

      setAnalysis({
        paceCV,
        heartRateCV,
        paceCVCategory,
        heartRateCVCategory,
        diagnosis,
        hasValidData: true,
        dataPoints: seriesData.length,
        activitySource: chartData.activity_source
      });

    } catch (err) {
      console.error('Erro ao calcular análise de variação:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Auto-calculate when activityId changes
  React.useEffect(() => {
    calculateVariationFromChartData();
  }, [activityId]);

  const getCVBadgeClass = (category: 'Baixo' | 'Alto') => {
    if (category === 'Baixo') {
      return 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600';
    } else {
      return 'bg-red-600 hover:bg-red-700 text-white border-red-600';
    }
  };

  if (!activityId) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Análise de Variação</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            Selecione uma atividade no preview acima para analisar a variação
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">

      {/* Resultado da Análise */}
      {error && (
        <Card className="glass-card border-glass-border">
          <CardContent className="py-6">
            <div className="flex items-center text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>Erro: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <Card className="glass-card border-glass-border">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <span>Resultado da Análise</span>
                <Badge variant="outline" className="text-xs">
                  {analysis.dataPoints} pontos
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {analysis.activitySource.toUpperCase()}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {analysis.hasValidData ? (
              <>
                {/* Coeficientes de Variação */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50">
                    <div className="flex items-center space-x-3">
                      <Heart className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Coeficiente de Variação FC</p>
                        <p className="text-sm text-muted-foreground">
                          CV: {(analysis.heartRateCV * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <Badge className={getCVBadgeClass(analysis.heartRateCVCategory)}>
                      {analysis.heartRateCVCategory}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50">
                    <div className="flex items-center space-x-3">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Coeficiente de Variação Pace</p>
                        <p className="text-sm text-muted-foreground">
                          CV: {(analysis.paceCV * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <Badge className={getCVBadgeClass(analysis.paceCVCategory)}>
                      {analysis.paceCVCategory}
                    </Badge>
                  </div>
                </div>

                {/* Diagnóstico */}
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-start space-x-3">
                    <Target className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-medium text-primary mb-1">Diagnóstico da Atividade</h4>
                      <div className="text-sm text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({node, ...props}) => <p className="mb-0 text-muted-foreground" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                          }}
                        >
                          {analysis.diagnosis}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legenda */}
                <div className="text-xs text-muted-foreground border-t border-border/50 pt-4 space-y-1">
                  <p className="mb-2">
                    <strong>Coeficiente de Variação (CV):</strong> Medida de variabilidade relativa (desvio padrão / média)
                  </p>
                  <p>
                    <strong>FC:</strong> Baixo ≤ 15% | Alto {'>'} 15%
                  </p>
                  <p>
                    <strong>Pace:</strong> Baixo ≤ 30% | Alto {'>'} 30%
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center text-muted-foreground">
                <AlertCircle className="h-5 w-5 mr-2" />
                <div>
                  <p>{analysis.diagnosis}</p>
                  <p className="text-xs mt-1">
                    Pontos de dados: {analysis.dataPoints} (mínimo necessário: 10)
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};