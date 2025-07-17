import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Clock, Heart, TrendingUp } from 'lucide-react';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';

interface PerformanceIndicatorsProps {
  activityId: string;
}

export const PerformanceIndicators = ({ activityId }: PerformanceIndicatorsProps) => {
  console.log('🔍 PERF_INDICATORS: Rendering with activityId:', activityId);
  const { metrics, loading, error } = usePerformanceMetrics(activityId);
  
  console.log('🔍 PERF_INDICATORS: Hook state:', { 
    hasMetrics: !!metrics, 
    loading, 
    error,
    metricsDetail: metrics 
  });

  if (loading) {
    console.log('🔍 PERF_INDICATORS: Showing loading state');
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>Indicadores de Performance</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Calculando indicadores...</p>
            <p className="text-xs text-muted-foreground mt-2">Activity ID: {activityId}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics) {
    console.log('🔍 PERF_INDICATORS: Showing error/no data state:', { error, hasMetrics: !!metrics });
    return (
      <Card className="glass-card border-glass-border bg-red-50 border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>Indicadores de Performance</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">
              {error ? 'Erro ao calcular indicadores' : 'Dados insuficientes para calcular indicadores'}
            </p>
            {error && (
              <p className="text-xs text-red-600 bg-red-100 p-2 rounded">{error}</p>
            )}
            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              <p>Activity ID: {activityId}</p>
              <p>Has Metrics: {metrics ? 'Yes' : 'No'}</p>
              <p>Error: {error || 'None'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const indicators = [
    {
      icon: Settings,
      title: 'Eficiência',
      emoji: '⚙️',
      metrics: [
        { label: 'Potência por batimento', value: metrics.efficiency.powerPerBeat },
        { label: 'Distância por minuto', value: metrics.efficiency.distancePerMinute }
      ],
      comment: metrics.efficiency.comment,
      color: 'text-blue-400'
    },
    {
      icon: Clock,
      title: 'Ritmo',
      emoji: '⏱️',
      metrics: [
        { label: 'Velocidade média', value: metrics.pace.averageSpeed },
        { label: 'Coef. variação do ritmo', value: metrics.pace.variationCoefficient }
      ],
      comment: metrics.pace.comment,
      color: 'text-green-400'
    },
    {
      icon: Heart,
      title: 'Frequência Cardíaca',
      emoji: '❤️',
      metrics: [
        { label: 'FC média', value: metrics.heartRate.averageHR },
        { label: 'Intensidade relativa', value: metrics.heartRate.relativeIntensity },
        { label: 'Reserva de FC relativa', value: metrics.heartRate.relativeReserve }
      ],
      comment: metrics.heartRate.comment,
      color: 'text-red-400'
    },
    {
      icon: TrendingUp,
      title: 'Distribuição do Esforço',
      emoji: '📈',
      metrics: [
        { label: 'Início', value: metrics.effortDistribution.beginning },
        { label: 'Meio', value: metrics.effortDistribution.middle },
        { label: 'Fim', value: metrics.effortDistribution.end }
      ],
      comment: metrics.effortDistribution.comment,
      color: 'text-purple-400'
    }
  ];

  console.log('🔍 PERF_INDICATORS: Rendering indicators successfully');

  return (
    <Card className="glass-card border-glass-border bg-green-50 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span>Indicadores de Performance ✅</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {indicators.map((indicator, index) => (
            <div key={index} className="space-y-4">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{indicator.emoji}</span>
                <div>
                  <h3 className="font-semibold text-lg">{indicator.title}</h3>
                </div>
              </div>
              
              <div className="space-y-2">
                {indicator.metrics.map((metric, metricIndex) => (
                  <div key={metricIndex} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{metric.label}</span>
                    <Badge variant="outline" className={`${indicator.color} font-mono`}>
                      {metric.value}
                    </Badge>
                  </div>
                ))}
              </div>
              
              <div className="p-3 bg-muted/10 rounded-lg">
                <p className="text-sm text-muted-foreground italic">
                  {indicator.comment}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};