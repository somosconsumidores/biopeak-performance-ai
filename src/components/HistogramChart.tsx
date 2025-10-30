import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, TrendingUp, BarChart3, Info } from 'lucide-react';
import { useActivityDetailsChart } from '@/hooks/useActivityDetailsChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface HistogramChartProps {
  activityId: string;
  refreshTrigger?: number;
  activitySource?: string;
}

export const HistogramChart = ({ activityId, refreshTrigger, activitySource }: HistogramChartProps) => {
  // Default to 'pace' for biopeak activities (no heart rate data)
  const defaultView = activitySource === 'biopeak' ? 'pace' : 'heart_rate';
  const [activeView, setActiveView] = useState<'heart_rate' | 'pace'>(defaultView);
  const { data: chartData, loading, error } = useActivityDetailsChart(activityId, refreshTrigger);

  if (loading) {
    return (
      <Card className="glass-card border-glass-border">
        <CardContent className="py-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando histograma...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !chartData || chartData.length === 0) {
    return (
      <Card className="glass-card border-glass-border">
        <CardContent className="py-6 text-center text-muted-foreground">
          Dados insuficientes para gerar histograma
        </CardContent>
      </Card>
    );
  }

  // Process data for histograms
  const processHistogramData = () => {
    if (activeView === 'heart_rate') {
      const heartRates = chartData
        .filter(d => d.heart_rate && d.heart_rate > 0)
        .map(d => d.heart_rate);

      if (heartRates.length === 0) return { data: [], stats: null };

      // Create bins for heart rate (10 bpm intervals)
      const min = Math.min(...heartRates);
      const max = Math.max(...heartRates);
      const binSize = 10;
      const binCount = Math.ceil((max - min) / binSize);
      
      const bins = Array.from({ length: binCount }, (_, i) => ({
        range: `${Math.round(min + i * binSize)}-${Math.round(min + (i + 1) * binSize)}`,
        count: 0,
        percentage: 0,
        lowerBound: min + i * binSize,
        upperBound: min + (i + 1) * binSize
      }));

      heartRates.forEach(hr => {
        const binIndex = Math.min(Math.floor((hr - min) / binSize), binCount - 1);
        bins[binIndex].count++;
      });

      bins.forEach(bin => {
        bin.percentage = (bin.count / heartRates.length) * 100;
      });

      // Calculate statistics
      const mean = heartRates.reduce((a, b) => a + b, 0) / heartRates.length;
      const sortedHR = heartRates.sort((a, b) => a - b);
      const median = sortedHR[Math.floor(sortedHR.length / 2)];
      const std = Math.sqrt(heartRates.reduce((sum, hr) => sum + Math.pow(hr - mean, 2), 0) / heartRates.length);
      
      return {
        data: bins.filter(bin => bin.count > 0),
        stats: {
          mean: Math.round(mean),
          median: Math.round(median),
          std: Math.round(std),
          min: Math.round(min),
          max: Math.round(max),
          total: heartRates.length
        }
      };
    } else {
      const paces = chartData
        .filter(d => d.pace_min_per_km && d.pace_min_per_km > 0 && d.pace_min_per_km < 20) // Filter out unrealistic paces
        .map(d => d.pace_min_per_km!);

      if (paces.length === 0) return { data: [], stats: null };

      // Create bins for pace (30 second intervals)
      const min = Math.min(...paces);
      const max = Math.max(...paces);
      const binSize = 0.5; // 30 seconds
      const binCount = Math.ceil((max - min) / binSize);
      
      const bins = Array.from({ length: binCount }, (_, i) => ({
        range: `${formatPaceRange(min + i * binSize)}-${formatPaceRange(min + (i + 1) * binSize)}`,
        count: 0,
        percentage: 0,
        lowerBound: min + i * binSize,
        upperBound: min + (i + 1) * binSize
      }));

      paces.forEach(pace => {
        const binIndex = Math.min(Math.floor((pace - min) / binSize), binCount - 1);
        bins[binIndex].count++;
      });

      bins.forEach(bin => {
        bin.percentage = (bin.count / paces.length) * 100;
      });

      // Calculate statistics
      const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
      const sortedPace = paces.sort((a, b) => a - b);
      const median = sortedPace[Math.floor(sortedPace.length / 2)];
      const std = Math.sqrt(paces.reduce((sum, pace) => sum + Math.pow(pace - mean, 2), 0) / paces.length);
      
      return {
        data: bins.filter(bin => bin.count > 0),
        stats: {
          mean: formatPace(mean),
          median: formatPace(median),
          std: `${Math.round(std * 60)}s`,
          min: formatPace(min),
          max: formatPace(max),
          total: paces.length
        }
      };
    }
  };

  const formatPace = (paceMinutes: number) => {
    const minutes = Math.floor(paceMinutes);
    const seconds = Math.round((paceMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatPaceRange = (paceMinutes: number) => {
    const minutes = Math.floor(paceMinutes);
    const seconds = Math.round((paceMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const { data: histogramData, stats } = processHistogramData();

  // Get color for bars - higher frequency gets more intense color
  const getBarColor = (percentage: number) => {
    const maxPercentage = Math.max(...histogramData.map(d => d.percentage));
    const intensity = percentage / maxPercentage;
    if (activeView === 'heart_rate') {
      return `hsl(var(--destructive) / ${0.3 + intensity * 0.7})`;
    } else {
      return `hsl(var(--primary) / ${0.3 + intensity * 0.7})`;
    }
  };

  const getInterpretation = () => {
    if (!stats) return null;

    if (activeView === 'heart_rate') {
      const meanHR = parseInt(stats.mean.toString());
      const stdHR = parseInt(stats.std.toString());
      
      let consistency = 'moderada';
      let interpretation = '';
      
      if (stdHR < 10) {
        consistency = 'alta';
        interpretation = 'Frequência cardíaca muito consistente, indicando ritmo bem controlado durante toda a atividade.';
      } else if (stdHR > 20) {
        consistency = 'baixa';
        interpretation = 'Grande variação na frequência cardíaca, possivelmente devido a mudanças de intensidade ou terreno.';
      } else {
        interpretation = 'Variação normal da frequência cardíaca durante a atividade.';
      }

      return {
        consistency,
        interpretation,
        recommendations: meanHR > 150 ? 'Treino de alta intensidade. Considere incluir períodos de recuperação.' : 'Intensidade moderada, ideal para treinos aeróbicos.'
      };
    } else {
      const stdSeconds = parseInt(String(stats.std).replace('s', ''));
      
      let consistency = 'moderada';
      let interpretation = '';
      
      if (stdSeconds < 15) {
        consistency = 'alta';
        interpretation = 'Ritmo muito consistente, demonstrando excelente controle de pace durante a corrida.';
      } else if (stdSeconds > 30) {
        consistency = 'baixa';
        interpretation = 'Grande variação no ritmo, possivelmente devido a mudanças no terreno ou estratégia de corrida.';
      } else {
        interpretation = 'Variação normal do ritmo durante a atividade.';
      }

      return {
        consistency,
        interpretation,
        recommendations: consistency === 'baixa' ? 'Pratique manter um ritmo mais constante em treinos futuros.' : 'Excelente controle de ritmo!'
      };
    }
  };

  const interpretation = getInterpretation();

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Distribuição de {activeView === 'heart_rate' ? 'Frequência Cardíaca' : 'Ritmo'}</span>
          </CardTitle>
          <div className="flex space-x-2">
            <Button
              variant={activeView === 'heart_rate' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('heart_rate')}
              className="flex items-center space-x-1"
            >
              <Heart className="h-4 w-4" />
              <span>FC</span>
            </Button>
            <Button
              variant={activeView === 'pace' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('pace')}
              className="flex items-center space-x-1"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Pace</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {histogramData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Dados insuficientes para {activeView === 'heart_rate' ? 'frequência cardíaca' : 'ritmo'}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Histogram Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="range" 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    label={{ 
                      value: 'Frequência (%)', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
                    }}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{activeView === 'heart_rate' ? 'FC' : 'Pace'}: {label}</p>
                            <p className="text-sm text-muted-foreground">
                              Frequência: {data.count} ({data.percentage.toFixed(1)}%)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="percentage" radius={[2, 2, 0, 0]}>
                    {histogramData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.percentage)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Statistics */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold">{stats.mean}</div>
                  <div className="text-xs text-muted-foreground">Média</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{stats.median}</div>
                  <div className="text-xs text-muted-foreground">Mediana</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{stats.std}</div>
                  <div className="text-xs text-muted-foreground">Desvio Padrão</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Amostras</div>
                </div>
              </div>
            )}

            {/* Interpretation */}
            {interpretation && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Análise Estatística</span>
                  <Badge variant={interpretation.consistency === 'alta' ? 'default' : interpretation.consistency === 'moderada' ? 'secondary' : 'destructive'}>
                    Consistência {interpretation.consistency}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{interpretation.interpretation}</p>
                <p className="text-sm font-medium">{interpretation.recommendations}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};