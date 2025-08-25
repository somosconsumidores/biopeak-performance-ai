import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TrendingUp, Heart, Target, BarChart3, AlertCircle, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

export const ActivityVariationAnalysis = () => {
  const [activityId, setActivityId] = useState('');
  const [analysis, setAnalysis] = useState<VariationAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateVariationFromChartData = async () => {
    if (!activityId.trim()) {
      setError('Por favor, insira um Activity ID');
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
        .eq('activity_id', activityId.trim())
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

      // Categorizar CVs
      const heartRateCVCategory: 'Baixo' | 'Alto' = heartRateCV <= 0.15 ? 'Baixo' : 'Alto';
      const paceCVCategory: 'Baixo' | 'Alto' = paceCV <= 0.15 ? 'Baixo' : 'Alto';

      // Determinar diagnóstico
      let diagnosis = '';
      if (heartRates.length < 10) {
        diagnosis = 'Análise baseada apenas no pace (dados de FC insuficientes)';
      } else if (paces.length < 10) {
        diagnosis = 'Análise baseada apenas na FC (dados de pace insuficientes)';
      } else {
        if (heartRateCVCategory === 'Baixo' && paceCVCategory === 'Baixo') {
          diagnosis = 'Ritmo e esforço constantes → treino contínuo e controlado';
        } else if (heartRateCVCategory === 'Baixo' && paceCVCategory === 'Alto') {
          diagnosis = 'Ritmo variando mas esforço cardiovascular constante → você ajustou o pace para manter FC estável (estratégia eficiente em provas longas)';
        } else if (heartRateCVCategory === 'Alto' && paceCVCategory === 'Baixo') {
          diagnosis = 'Ritmo constante mas FC variando → possível fadiga, desidratação, temperatura alta ou pouca adaptação ao esforço';
        } else {
          diagnosis = 'Ritmo e esforço muito variáveis → treino intervalado, fartlek, ou atividade desorganizada';
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

  const getCVBadgeClass = (category: 'Baixo' | 'Alto') => {
    if (category === 'Baixo') {
      return 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600';
    } else {
      return 'bg-red-600 hover:bg-red-700 text-white border-red-600';
    }
  };

  return (
    <div className="space-y-4">
      {/* Input para Activity ID */}
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Análise de Variação (activity_chart_data)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="Insira o Activity ID"
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              className="flex-1"
            />
            <Button onClick={calculateVariationFromChartData} disabled={loading}>
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

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
                    <strong>Coeficiente de Variação (CV):</strong> Medida de variabilidade relativa, calculado pelo desvio padrão sobre a média
                  </p>
                  <p>
                    <strong>Baixo ≤ 15%</strong> | <strong>Alto {'>'} 15%</strong>
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