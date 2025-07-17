import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Clock, Heart, TrendingUp } from 'lucide-react';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';

interface PerformanceIndicatorsProps {
  activityId: string;
}

export const PerformanceIndicators = ({ activityId }: PerformanceIndicatorsProps) => {
  const { metrics, loading, error } = usePerformanceMetrics(activityId);

  // Debug logging to verify data received by component
  console.log('🎯 PerformanceIndicators - Activity ID:', activityId);
  console.log('🎯 PerformanceIndicators - Metrics received:', metrics);
  console.log('🎯 PerformanceIndicators - Loading state:', loading);
  console.log('🎯 PerformanceIndicators - Error state:', error);
  
  if (metrics?.effortDistribution) {
    console.log('🔥 EFFORT DISTRIBUTION DATA:');
    console.log('  - Beginning:', metrics.effortDistribution.beginning);
    console.log('  - Middle:', metrics.effortDistribution.middle);
    console.log('  - End:', metrics.effortDistribution.end);
    console.log('  - Comment:', metrics.effortDistribution.comment);
  }

  if (loading) {
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
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics) {
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
            <p className="text-muted-foreground">Dados insuficientes para calcular indicadores</p>
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

  return (
    <Card key={activityId} className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span>Indicadores de Performance</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {indicators.map((indicator, index) => (
            <div key={`${activityId}-${index}`} className="space-y-4">
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