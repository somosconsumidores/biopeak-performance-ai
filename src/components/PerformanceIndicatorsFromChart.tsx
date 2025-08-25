import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  RefreshCw, 
  Activity, 
  Heart, 
  TrendingUp, 
  Zap, 
  Target,
  Gauge,
  AlertCircle,
  Search
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  mainValue: string;
  mainLabel: string;
  secondaryValue?: string;
  secondaryLabel?: string;
  distributionValues?: {
    beginning?: string;
    middle?: string;
    end?: string;
    unit: string;
  };
  comment: string;
  gradient: string;
  iconColor: string;
}

const MetricCard = ({ 
  icon, 
  title, 
  mainValue, 
  mainLabel, 
  secondaryValue, 
  secondaryLabel, 
  distributionValues,
  comment, 
  gradient,
  iconColor 
}: MetricCardProps) => (
  <Card className={`relative overflow-hidden border-0 ${gradient} backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 group`}>
    <CardContent className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${iconColor} bg-opacity-20 group-hover:bg-opacity-30 transition-all duration-300`}>
          {icon}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground/90">{mainValue}</div>
          <div className="text-sm font-medium text-foreground/70">{mainLabel}</div>
        </div>
      </div>
      
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground/90">{title}</h3>
        
        {distributionValues ? (
          <div className="space-y-2">
            {distributionValues.beginning && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground/70">Início:</span>
                <span className="text-base font-semibold text-foreground/80">
                  {distributionValues.beginning} {distributionValues.unit}
                </span>
              </div>
            )}
            {distributionValues.middle && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground/70">Meio:</span>
                <span className="text-base font-semibold text-foreground/80">
                  {distributionValues.middle} {distributionValues.unit}
                </span>
              </div>
            )}
            {distributionValues.end && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground/70">Fim:</span>
                <span className="text-base font-semibold text-foreground/80">
                  {distributionValues.end} {distributionValues.unit}
                </span>
              </div>
            )}
          </div>
        ) : secondaryValue && (
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-foreground/70">{secondaryLabel}:</span>
            <span className="text-base font-semibold text-foreground/80">{secondaryValue}</span>
          </div>
        )}
        
        <div className="pt-2 border-t border-white/20">
          <p className="text-sm leading-relaxed text-foreground/70">{comment}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

interface PerformanceData {
  efficiency: {
    distancePerMinute: number | null;
    comment: string;
  };
  pace: {
    averageSpeedKmh: number | null;
    paceVariationCoefficient: number | null;
    comment: string;
  };
  heartRate: {
    averageHr: number | null;
    maxHr: number | null;
    relativeIntensity: number | null;
    comment: string;
  };
  effortDistribution: {
    beginning: number | null;
    middle: number | null;
    end: number | null;
    comment: string;
  };
  activitySource: string;
  dataPoints: number;
}

export const PerformanceIndicatorsFromChart = () => {
  const [activityId, setActivityId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);

  const calculatePerformanceFromChartData = async () => {
    if (!activityId.trim()) {
      setError('Por favor, insira um Activity ID');
      return;
    }

    setLoading(true);
    setError(null);
    setPerformanceData(null);

    try {
      // Buscar dados do activity_chart_data
      const { data: chartData, error: chartError } = await supabase
        .from('activity_chart_data')
        .select('series_data, activity_source, data_points_count')
        .eq('activity_id', activityId.trim())
        .single();

      if (chartError) {
        throw new Error(`Atividade não encontrada: ${chartError.message}`);
      }

      if (!chartData?.series_data || !Array.isArray(chartData.series_data)) {
        throw new Error('Dados de série não encontrados');
      }

      const seriesData = chartData.series_data;
      
      if (seriesData.length < 10) {
        throw new Error('Dados insuficientes para análise de performance (mínimo 10 pontos)');
      }

      // Processar dados da série
      const heartRates: number[] = [];
      const paces: number[] = [];
      const speeds: number[] = [];
      let totalDistance = 0;
      let totalTime = 0;
      let hasTimeData = false;

      seriesData.forEach((point: any, index: number) => {
        // Heart rate
        const hr = point.heart_rate || point.hr;
        if (typeof hr === 'number' && hr > 0) {
          heartRates.push(hr);
        }

        // Pace
        const pace = point.pace_min_km;
        if (typeof pace === 'number' && pace > 0 && pace < 60) {
          paces.push(pace);
          // Converter pace para velocidade (km/h)
          speeds.push(60 / pace);
        }

        // Distância acumulada
        const distance = point.distance_m;
        if (typeof distance === 'number' && distance > totalDistance) {
          totalDistance = distance;
        }

        // Tempo acumulado - verificar diferentes campos possíveis
        const elapsed = point.elapsed_time_seconds || point.t || point.time || point.elapsed_time;
        if (typeof elapsed === 'number' && elapsed > totalTime) {
          totalTime = elapsed;
          hasTimeData = true;
        }
      });

      // Calcular métricas de eficiência
      const distanceKm = totalDistance / 1000;
      const timeMinutes = totalTime / 60;
      let distancePerMinute: number | null = null;

      // Se não temos dados de tempo, tentar estimar usando velocidade média
      if (!hasTimeData || timeMinutes === 0) {
        if (speeds.length > 0) {
          const avgSpeedKmh = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
          distancePerMinute = avgSpeedKmh / 60; // km/h para km/min
        }
      } else {
        distancePerMinute = timeMinutes > 0 ? distanceKm / timeMinutes : null;
      }

      // Calcular métricas de pace
      const averageSpeedKmh = speeds.length > 0 
        ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length 
        : null;

      let paceVariationCoefficient: number | null = null;
      if (paces.length >= 10) {
        const avgPace = paces.reduce((sum, pace) => sum + pace, 0) / paces.length;
        const paceVariance = paces.reduce((sum, pace) => sum + Math.pow(pace - avgPace, 2), 0) / paces.length;
        const paceStdDev = Math.sqrt(paceVariance);
        paceVariationCoefficient = (paceStdDev / avgPace) * 100;
      }

      // Calcular métricas de frequência cardíaca
      const averageHr = heartRates.length > 0 
        ? Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length)
        : null;
      
      const maxHr = heartRates.length > 0 
        ? Math.max(...heartRates)
        : null;

      const relativeIntensity = averageHr && maxHr 
        ? Math.round((averageHr / maxHr) * 100)
        : null;

      // Calcular distribuição do esforço
      let beginning: number | null = null;
      let middle: number | null = null;
      let end: number | null = null;

      if (heartRates.length >= 30) {
        const third = Math.floor(heartRates.length / 3);
        beginning = Math.round(heartRates.slice(0, third).reduce((sum, hr) => sum + hr, 0) / third);
        middle = Math.round(heartRates.slice(third, 2 * third).reduce((sum, hr) => sum + hr, 0) / third);
        end = Math.round(heartRates.slice(2 * third).reduce((sum, hr) => sum + hr, 0) / (heartRates.length - 2 * third));
      }

      // Gerar comentários
      let efficiencyComment = 'Dados insuficientes para calcular eficiência';
      if (distancePerMinute) {
        const method = hasTimeData ? 'baseado no tempo' : 'estimado pela velocidade média';
        efficiencyComment = `Eficiência: ${distancePerMinute.toFixed(2)} km/min (${method})`;
      } else if (!hasTimeData && speeds.length === 0) {
        efficiencyComment = 'Sem dados de tempo ou velocidade para calcular eficiência';
      }

      let paceComment = 'Dados insuficientes';
      if (paceVariationCoefficient !== null) {
        if (paceVariationCoefficient <= 5) paceComment = 'Ritmo muito consistente';
        else if (paceVariationCoefficient <= 10) paceComment = 'Ritmo consistente';
        else if (paceVariationCoefficient <= 20) paceComment = 'Ritmo moderadamente variável';
        else paceComment = 'Ritmo muito variável';
      }

      const heartRateComment = averageHr 
        ? `FC média: ${averageHr} bpm${relativeIntensity ? ` (${relativeIntensity}% da FC máxima)` : ''}`
        : 'Dados de FC insuficientes';

      let effortComment = 'Dados insuficientes';
      if (beginning && middle && end) {
        const maxEffort = Math.max(beginning, middle, end);
        const minEffort = Math.min(beginning, middle, end);
        if (maxEffort - minEffort <= 10) effortComment = 'Esforço muito consistente';
        else if (maxEffort - minEffort <= 20) effortComment = 'Esforço moderadamente consistente';
        else effortComment = 'Esforço variável';
      }

      setPerformanceData({
        efficiency: {
          distancePerMinute,
          comment: efficiencyComment
        },
        pace: {
          averageSpeedKmh,
          paceVariationCoefficient,
          comment: paceComment
        },
        heartRate: {
          averageHr,
          maxHr,
          relativeIntensity,
          comment: heartRateComment
        },
        effortDistribution: {
          beginning,
          middle,
          end,
          comment: effortComment
        },
        activitySource: chartData.activity_source,
        dataPoints: seriesData.length
      });

      toast.success('Indicadores de performance calculados com sucesso!');

    } catch (err) {
      console.error('Erro ao calcular indicadores:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      toast.error('Erro ao calcular indicadores de performance');
    } finally {
      setLoading(false);
    }
  };

  const hasHeartRateData = performanceData?.heartRate.averageHr !== null;

  const metricCards = performanceData ? [
    // Eficiência
    {
      icon: <Zap className="h-6 w-6" />,
      title: 'Eficiência',
      mainValue: performanceData.efficiency.distancePerMinute !== null 
        ? `${performanceData.efficiency.distancePerMinute.toFixed(2)}`
        : 'N/A',
      mainLabel: 'km/min',
      comment: performanceData.efficiency.comment,
      gradient: 'bg-gradient-to-br from-yellow-400/20 to-orange-500/20',
      iconColor: 'bg-yellow-400'
    },
    
    // Ritmo & Velocidade
    {
      icon: <Gauge className="h-6 w-6" />,
      title: 'Ritmo & Velocidade',
      mainValue: performanceData.pace.averageSpeedKmh !== null
        ? `${performanceData.pace.averageSpeedKmh.toFixed(1)}`
        : 'N/A',
      mainLabel: 'km/h',
      secondaryValue: performanceData.pace.paceVariationCoefficient !== null
        ? `${performanceData.pace.paceVariationCoefficient.toFixed(1)}%`
        : undefined,
      secondaryLabel: 'Variação',
      comment: performanceData.pace.comment,
      gradient: 'bg-gradient-to-br from-blue-400/20 to-cyan-500/20',
      iconColor: 'bg-blue-400'
    },
    
    // Frequência Cardíaca
    {
      icon: <Heart className="h-6 w-6" />,
      title: 'Frequência Cardíaca',
      mainValue: performanceData.heartRate.averageHr !== null 
        ? `${performanceData.heartRate.averageHr}`
        : 'N/A',
      mainLabel: 'bpm',
      secondaryValue: performanceData.heartRate.relativeIntensity !== null 
        ? `${performanceData.heartRate.relativeIntensity}%`
        : undefined,
      secondaryLabel: 'Intensidade',
      comment: performanceData.heartRate.comment,
      gradient: 'bg-gradient-to-br from-red-400/20 to-pink-500/20',
      iconColor: 'bg-red-400'
    },
    
    // Distribuição do Esforço
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: 'Distribuição do Esforço',
      mainValue: performanceData.effortDistribution.middle !== null
        ? `${Math.round(performanceData.effortDistribution.middle)}`
        : 'N/A',
      mainLabel: hasHeartRateData ? 'bpm médio' : 'N/A',
      distributionValues: (performanceData.effortDistribution.beginning !== null && 
                          performanceData.effortDistribution.middle !== null && 
                          performanceData.effortDistribution.end !== null) ? {
        beginning: `${Math.round(performanceData.effortDistribution.beginning)}`,
        middle: `${Math.round(performanceData.effortDistribution.middle)}`,
        end: `${Math.round(performanceData.effortDistribution.end)}`,
        unit: 'bpm'
      } : undefined,
      comment: performanceData.effortDistribution.comment,
      gradient: 'bg-gradient-to-br from-purple-400/20 to-indigo-500/20',
      iconColor: 'bg-purple-400'
    }
  ] : [];

  return (
    <div className="space-y-6">
      {/* Input para Activity ID */}
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Indicadores de Performance (activity_chart_data)</span>
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
            <Button onClick={calculatePerformanceFromChartData} disabled={loading}>
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Erro */}
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

      {/* Resultado dos Indicadores */}
      {performanceData && (
        <div className="space-y-6">
          {/* Header */}
          <Card className="glass-card border-glass-border">
            <CardHeader className="space-y-4 pb-4">
              <div className="flex items-start justify-between flex-row">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="font-bold text-2xl">
                      Indicadores de Performance
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Análise detalhada da sua atividade
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    {performanceData.dataPoints} pontos
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {performanceData.activitySource.toUpperCase()}
                  </Badge>
                  <Badge 
                    variant={hasHeartRateData ? "default" : "secondary"} 
                    className="font-medium px-3 py-1 text-sm"
                  >
                    {hasHeartRateData ? (
                      <>
                        <Heart className="h-3 w-3 mr-1" />
                        COM FC
                      </>
                    ) : (
                      <>
                        <Activity className="h-3 w-3 mr-1" />
                        SEM FC
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Metrics Grid */}
          <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
            {metricCards.map((card, index) => (
              <MetricCard key={index} {...card} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};