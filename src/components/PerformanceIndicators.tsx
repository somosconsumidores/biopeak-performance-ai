import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, Clock, Heart, TrendingUp, RefreshCw } from 'lucide-react';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { useRecalculateMetrics } from '@/hooks/useRecalculateMetrics';
import { useIsMobile } from '@/hooks/use-mobile';

interface PerformanceIndicatorsProps {
  activityId: string;
}

export const PerformanceIndicators = ({ activityId }: PerformanceIndicatorsProps) => {
  const { metrics, loading, error } = usePerformanceMetrics(activityId);
  const recalculateMetrics = useRecalculateMetrics();
  const isMobile = useIsMobile();

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
        { label: 'Distância por minuto', value: `${metrics.efficiency.distancePerMinute} m/min` }
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
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>Indicadores de Performance</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => recalculateMetrics.mutate({ activityId })}
            disabled={recalculateMetrics.isPending}
            className="text-muted-foreground hover:text-primary"
          >
            <RefreshCw className={`h-4 w-4 ${recalculateMetrics.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} ${isMobile ? 'gap-4' : 'gap-6'}`}>
          {indicators.map((indicator, index) => (
            <div key={`${activityId}-${index}`} className={`space-y-3 ${isMobile ? 'p-3 bg-muted/5 rounded-lg' : 'space-y-4'}`}>
              <div className="flex items-center space-x-3">
                <span className={`${isMobile ? 'text-xl' : 'text-2xl'}`}>{indicator.emoji}</span>
                <div>
                  <h3 className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>{indicator.title}</h3>
                </div>
              </div>
              
              <div className={`space-y-2 ${isMobile ? 'space-y-1.5' : 'space-y-2'}`}>
                {indicator.metrics.map((metric, metricIndex) => (
                  <div key={metricIndex} className={`flex justify-between items-center ${isMobile ? 'gap-2' : ''}`}>
                    <span className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'} ${isMobile ? 'flex-1' : ''}`}>{metric.label}</span>
                    <Badge variant="outline" className={`${indicator.color} font-mono ${isMobile ? 'text-xs px-2 py-1' : ''} flex-shrink-0`}>
                      {metric.value}
                    </Badge>
                  </div>
                ))}
              </div>
              
              <div className={`bg-muted/10 rounded-lg ${isMobile ? 'p-2' : 'p-3'}`}>
                <p className={`text-muted-foreground italic ${isMobile ? 'text-xs' : 'text-sm'}`}>
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