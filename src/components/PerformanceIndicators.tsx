import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Activity, Heart, TrendingUp, Zap, Timer } from 'lucide-react';
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

  // Detect if this is a Strava activity (no heart rate data)
  const hasHeartRateData = metrics?.heartRate?.averageHr !== null;

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Indicadores de Performance</CardTitle>
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
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Indicadores de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Dados insuficientes para calcular indicadores</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-medium">Indicadores de Performance</CardTitle>
          <Badge variant={hasHeartRateData ? "default" : "secondary"} className="text-xs">
            {hasHeartRateData ? "COM FC" : "SEM FC"}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => recalculateMetrics.mutate({ activityId })}
          disabled={recalculateMetrics.isPending}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className={`h-4 w-4 ${recalculateMetrics.isPending ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
          {/* Eficiência / Eficiência de Movimento */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <h3 className="text-sm font-medium">
                {hasHeartRateData ? 'Eficiência' : 'Eficiência de Movimento'}
              </h3>
            </div>
            <div className="space-y-1">
              {hasHeartRateData && metrics.efficiency.powerPerBeat && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Potência/FC:</span> {metrics.efficiency.powerPerBeat.toFixed(1)} W/bpm
                </div>
              )}
              {metrics.efficiency.distancePerMinute && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">
                    {hasHeartRateData ? 'Distância/min:' : 'Distância/min:'}
                  </span> {(metrics.efficiency.distancePerMinute * (hasHeartRateData ? 1000 : 1)).toFixed(hasHeartRateData ? 0 : 2)} {hasHeartRateData ? 'm/min' : 'km/min'}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{metrics.efficiency.comment}</p>
            </div>
          </div>

          {/* Ritmo */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-medium">Ritmo</h3>
            </div>
            <div className="space-y-1">
              {metrics.pace.averageSpeedKmh && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Velocidade:</span> {metrics.pace.averageSpeedKmh.toFixed(1)} km/h
                </div>
              )}
              {metrics.pace.paceVariationCoefficient && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">
                    {hasHeartRateData ? 'Variação:' : 'Consistência:'}
                  </span> {(metrics.pace.paceVariationCoefficient * 100).toFixed(1)}%
                </div>
              )}
              <p className="text-xs text-muted-foreground">{metrics.pace.comment}</p>
            </div>
          </div>

          {/* Frequência Cardíaca / Gestão de Terreno */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              {hasHeartRateData ? (
                <Heart className="h-4 w-4 text-red-500" />
              ) : (
                <TrendingUp className="h-4 w-4 text-green-500" />
              )}
              <h3 className="text-sm font-medium">
                {hasHeartRateData ? 'Frequência Cardíaca' : 'Gestão de Terreno'}
              </h3>
            </div>
            <div className="space-y-1">
              {hasHeartRateData ? (
                <>
                  {metrics.heartRate.averageHr && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">FC Média:</span> {metrics.heartRate.averageHr} bpm
                    </div>
                  )}
                  {metrics.heartRate.relativeIntensity && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Intensidade:</span> {(metrics.heartRate.relativeIntensity * 100).toFixed(0)}%
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Adaptação:</span> Baseada em elevação
                </div>
              )}
              <p className="text-xs text-muted-foreground">{metrics.heartRate.comment}</p>
            </div>
          </div>

          {/* Distribuição do Esforço / Distribuição do Pace */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              {hasHeartRateData ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <Timer className="h-4 w-4 text-purple-500" />
              )}
              <h3 className="text-sm font-medium">
                {hasHeartRateData ? 'Distribuição do Esforço' : 'Distribuição do Pace'}
              </h3>
            </div>
            <div className="space-y-1">
              {metrics.effortDistribution.beginning && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Início:</span> {
                    hasHeartRateData 
                      ? `${metrics.effortDistribution.beginning} bpm`
                      : `${metrics.effortDistribution.beginning.toFixed(2)} min/km`
                  }
                </div>
              )}
              {metrics.effortDistribution.middle && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Meio:</span> {
                    hasHeartRateData 
                      ? `${metrics.effortDistribution.middle} bpm`
                      : `${metrics.effortDistribution.middle.toFixed(2)} min/km`
                  }
                </div>
              )}
              {metrics.effortDistribution.end && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Fim:</span> {
                    hasHeartRateData 
                      ? `${metrics.effortDistribution.end} bpm`
                      : `${metrics.effortDistribution.end.toFixed(2)} min/km`
                  }
                </div>
              )}
              <p className="text-xs text-muted-foreground">{metrics.effortDistribution.comment}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};