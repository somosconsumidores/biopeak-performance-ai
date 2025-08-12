import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  RefreshCw, 
  Activity, 
  Heart, 
  TrendingUp, 
  Zap, 
  Timer, 
  Target,
  Mountain,
  Gauge,
  BarChart3
} from 'lucide-react';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { useRecalculateMetrics } from '@/hooks/useRecalculateMetrics';
import { useIsMobile } from '@/hooks/use-mobile';


interface PerformanceIndicatorsProps {
  activityId: string;
}

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

export const PerformanceIndicators = ({ activityId }: PerformanceIndicatorsProps) => {
  const { metrics, loading, error } = usePerformanceMetrics(activityId);
  const recalculateMetrics = useRecalculateMetrics();
  const isMobile = useIsMobile();

  // Detect if this is a Polar activity
  const isPolarActivity = metrics?.activity_source === 'polar';
  const hasHeartRateData = metrics?.heartRate?.averageHr !== null;

  if (loading) {
    return (
      <Card className="w-full glass-card border-glass-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold">Indicadores de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/30 border-t-primary mx-auto mb-6"></div>
              <div className="absolute inset-0 rounded-full h-12 w-12 border-4 border-primary/10 mx-auto animate-pulse"></div>
            </div>
            <h3 className="text-lg font-semibold mb-2">Calculando Indicadores</h3>
            <p className="text-muted-foreground">Analisando dados da sua atividade...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics) {
    return (
      <Card className="w-full glass-card border-glass-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold">Indicadores de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-6">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Dados Insuficientes</h3>
            <p className="text-muted-foreground">Não foi possível calcular os indicadores para esta atividade</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const metricCards = [
    // Eficiência / Eficiência de Movimento
    {
      icon: <Zap className="h-6 w-6" />,
      title: hasHeartRateData ? 'Eficiência' : 'Eficiência de Movimento',
      mainValue: metrics.efficiency.distancePerMinute 
        ? `${metrics.efficiency.distancePerMinute.toFixed(2)}`
        : 'N/A',
      mainLabel: hasHeartRateData ? 'm/min' : 'km/min',
      secondaryValue: hasHeartRateData && metrics.efficiency.powerPerBeat 
        ? `${metrics.efficiency.powerPerBeat.toFixed(1)} W/bpm` 
        : undefined,
      secondaryLabel: 'Potência/FC',
      comment: metrics.efficiency.comment,
      gradient: 'bg-gradient-to-br from-yellow-400/20 to-orange-500/20',
      iconColor: 'bg-yellow-400'
    },
    
    // Ritmo
    {
      icon: <Gauge className="h-6 w-6" />,
      title: 'Ritmo & Velocidade',
      mainValue: metrics.pace.averageSpeedKmh 
        ? `${metrics.pace.averageSpeedKmh.toFixed(1)}`
        : 'N/A',
      mainLabel: 'km/h',
      secondaryValue: metrics.pace.paceVariationCoefficient 
        ? `${metrics.pace.paceVariationCoefficient.toFixed(1)}%`
        : undefined,
      secondaryLabel: hasHeartRateData ? 'Variação' : 'Consistência',
      comment: metrics.pace.comment,
      gradient: 'bg-gradient-to-br from-blue-400/20 to-cyan-500/20',
      iconColor: 'bg-blue-400'
    },
    
    // Frequência Cardíaca / Gestão de Terreno / Eficiência Calórica
    {
      icon: isPolarActivity ? <Zap className="h-6 w-6" /> : (hasHeartRateData ? <Heart className="h-6 w-6" /> : <Mountain className="h-6 w-6" />),
      title: isPolarActivity ? 'Eficiência Calórica' : (hasHeartRateData ? 'Frequência Cardíaca' : 'Gestão de Terreno'),
      mainValue: isPolarActivity && metrics.calories 
        ? `${(metrics.calories / (metrics.efficiency.distancePerMinute ? (metrics.efficiency.distancePerMinute * (metrics.duration || 60)) : 1)).toFixed(0)}`
        : (hasHeartRateData && metrics.heartRate.averageHr 
          ? `${metrics.heartRate.averageHr}`
          : hasHeartRateData ? 'N/A' : 'Auto'),
      mainLabel: isPolarActivity ? 'cal/km' : (hasHeartRateData ? 'bpm' : 'Adaptação'),
      secondaryValue: isPolarActivity && metrics.calories 
        ? `${(metrics.calories / ((metrics.duration || 60) / 60)).toFixed(0)} cal/h`
        : (hasHeartRateData && metrics.heartRate.relativeIntensity 
          ? `${metrics.heartRate.relativeIntensity.toFixed(0)}%`
          : undefined),
      secondaryLabel: isPolarActivity ? 'Gasto/hora' : 'Intensidade',
      comment: isPolarActivity 
        ? `Eficiência energética: ${metrics.calories ? (metrics.calories / (metrics.efficiency.distancePerMinute ? (metrics.efficiency.distancePerMinute * (metrics.duration || 60)) : 1)).toFixed(0) + ' cal/km' : 'Dados insuficientes'}`
        : metrics.heartRate.comment,
      gradient: isPolarActivity 
        ? 'bg-gradient-to-br from-orange-400/20 to-red-500/20'
        : (hasHeartRateData 
          ? 'bg-gradient-to-br from-red-400/20 to-pink-500/20'
          : 'bg-gradient-to-br from-green-400/20 to-emerald-500/20'),
      iconColor: isPolarActivity ? 'bg-orange-400' : (hasHeartRateData ? 'bg-red-400' : 'bg-green-400')
    },
    
    // Intensidade Cardíaca / Distribuição do Esforço / Distribuição do Pace
    {
      icon: isPolarActivity ? <Heart className="h-6 w-6" /> : <TrendingUp className="h-6 w-6" />,
      title: isPolarActivity ? 'Intensidade Cardíaca' : (hasHeartRateData ? 'Distribuição do Esforço' : 'Distribuição do Pace'),
      mainValue: isPolarActivity && metrics.heartRate.averageHr
        ? `${metrics.heartRate.averageHr}`
        : (metrics.effortDistribution.middle 
          ? hasHeartRateData 
            ? `${metrics.effortDistribution.middle}`
            : `${metrics.effortDistribution.middle.toFixed(2)}`
          : 'N/A'),
      mainLabel: isPolarActivity ? 'bpm médio' : (hasHeartRateData ? 'bpm médio' : 'min/km médio'),
      distributionValues: isPolarActivity ? {
        beginning: metrics.heartRate.averageHr ? `${metrics.heartRate.averageHr}` : undefined,
        middle: metrics.heartRate.maxHr ? `${metrics.heartRate.maxHr}` : undefined,
        end: metrics.heartRate.relativeIntensity ? `${metrics.heartRate.relativeIntensity.toFixed(0)}%` : undefined,
        unit: 'zona'
      } : {
        beginning: metrics.effortDistribution.beginning 
          ? hasHeartRateData 
            ? `${metrics.effortDistribution.beginning}`
            : `${metrics.effortDistribution.beginning.toFixed(2)}`
          : undefined,
        middle: metrics.effortDistribution.middle 
          ? hasHeartRateData 
            ? `${metrics.effortDistribution.middle}`
            : `${metrics.effortDistribution.middle.toFixed(2)}`
          : undefined,
        end: metrics.effortDistribution.end 
          ? hasHeartRateData 
            ? `${metrics.effortDistribution.end}`
            : `${metrics.effortDistribution.end.toFixed(2)}`
          : undefined,
        unit: hasHeartRateData ? 'bpm' : 'min/km'
      },
      comment: isPolarActivity 
        ? `Zona de intensidade: ${metrics.heartRate.averageHr && metrics.heartRate.maxHr ? 
            ((metrics.heartRate.averageHr / metrics.heartRate.maxHr) * 100).toFixed(0) + '% da FC máxima' : 
            'Dados insuficientes'}`
        : metrics.effortDistribution.comment,
      gradient: isPolarActivity 
        ? 'bg-gradient-to-br from-pink-400/20 to-purple-500/20'
        : 'bg-gradient-to-br from-purple-400/20 to-indigo-500/20',
      iconColor: isPolarActivity ? 'bg-pink-400' : 'bg-purple-400'
    }
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <Card className="glass-card border-glass-border">
        <CardHeader className="space-y-4 pb-4">
          <div className={`flex items-start justify-between ${isMobile ? 'flex-col gap-4' : 'flex-row'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                  Indicadores de Performance
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Análise detalhada da sua atividade
                </p>
              </div>
            </div>
            
            <div className={`flex items-center ${isMobile ? 'w-full justify-between' : 'gap-3'}`}>
              {!isPolarActivity && (
                <Badge 
                  variant={hasHeartRateData ? "default" : "secondary"} 
                  className={`font-medium px-3 py-1 ${isMobile ? 'text-xs' : 'text-sm'}`}
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
              )}
              
              <Button
                variant="outline"
                size={isMobile ? "sm" : "sm"}
                onClick={() => recalculateMetrics.mutate({ activityId })}
                disabled={recalculateMetrics.isPending}
                className={`px-4 ${isMobile ? 'h-8 text-xs' : 'h-10'}`}
              >
                <RefreshCw className={`mr-2 ${recalculateMetrics.isPending ? 'animate-spin' : ''} ${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
                {recalculateMetrics.isPending ? 'Calculando...' : 'Recalcular'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Metrics Grid */}
      <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {metricCards.map((card, index) => (
          <MetricCard key={index} {...card} />
        ))}
      </div>
    </div>
  );
};