import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Clock, Heart, TrendingUp } from 'lucide-react';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';

interface PerformanceIndicatorsProps {
  activityId: string;
}

export const PerformanceIndicators = ({ activityId }: PerformanceIndicatorsProps) => {
  const { metrics, loading, error } = usePerformanceMetrics(activityId);

  // Enhanced debug logging to track component re-renders and data flow
  const renderTimestamp = new Date().toISOString();
  console.log(`🎯 [${renderTimestamp}] PerformanceIndicators RENDER`);
  console.log('  🔑 Activity ID:', activityId);
  console.log('  📊 Metrics received:', metrics);
  console.log('  ⏳ Loading state:', loading);
  console.log('  ❌ Error state:', error);
  
  // Special logging for metrics with timestamp
  if (metrics) {
    console.log('  🕒 Metrics timestamp:', (metrics as any)._timestamp);
    console.log('  🆔 Metrics activity ID:', (metrics as any)._activityId);
  }
  
  if (metrics?.effortDistribution) {
    console.log('🔥 COMPONENT EFFORT DISTRIBUTION:');
    console.log('  🟢 Beginning:', metrics.effortDistribution.beginning);
    console.log('  🟡 Middle:', metrics.effortDistribution.middle);
    console.log('  🔴 End:', metrics.effortDistribution.end);
    console.log('  💬 Comment:', metrics.effortDistribution.comment);
    
    // Check if values match expected pattern
    const beginVal = metrics.effortDistribution.beginning;
    const middleVal = metrics.effortDistribution.middle;
    const endVal = metrics.effortDistribution.end;
    console.log('  🔍 Raw values:', { beginVal, middleVal, endVal });
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
        { label: 'Potência por batimento', value: `${metrics.efficiency.powerPerBeat} W/bpm` },
        { label: 'Distância por minuto', value: `${metrics.efficiency.distancePerMinute} km/min` }
      ],
      comment: metrics.efficiency.comment,
      color: 'text-blue-400'
    },
    {
      icon: Clock,
      title: 'Ritmo',
      emoji: '⏱️',
      metrics: [
        { label: 'Velocidade média', value: `${metrics.pace.averageSpeedKmh} km/h` },
        { label: 'Coef. variação do ritmo', value: `${metrics.pace.paceVariationCoefficient}%` }
      ],
      comment: metrics.pace.comment,
      color: 'text-green-400'
    },
    {
      icon: Heart,
      title: 'Frequência Cardíaca',
      emoji: '❤️',
      metrics: [
        { label: 'FC média', value: `${metrics.heartRate.averageHr} bpm` },
        { label: 'Intensidade relativa', value: `${metrics.heartRate.relativeIntensity}%` },
        { label: 'Reserva de FC relativa', value: `${metrics.heartRate.relativeReserve}%` }
      ],
      comment: metrics.heartRate.comment,
      color: 'text-red-400'
    },
    {
      icon: TrendingUp,
      title: 'Distribuição do Esforço',
      emoji: '📈',
      metrics: [
        { label: 'Início', value: `${metrics.effortDistribution.beginning} bpm` },
        { label: 'Meio', value: `${metrics.effortDistribution.middle} bpm` },
        { label: 'Fim', value: `${metrics.effortDistribution.end} bpm` }
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