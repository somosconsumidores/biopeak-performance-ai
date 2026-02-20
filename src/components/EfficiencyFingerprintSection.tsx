import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Fingerprint, AlertTriangle, Brain, Sparkles } from 'lucide-react';
import { useEfficiencyFingerprint } from '@/hooks/useEfficiencyFingerprint';
import { EfficiencyHeatmapGrid } from './EfficiencyHeatmapGrid';
import { EfficiencySyncChart } from './EfficiencySyncChart';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumButton } from '@/components/PremiumButton';

interface Props {
  activityId: string | null;
}

export const EfficiencyFingerprintSection = ({ activityId }: Props) => {
  const { isSubscribed } = useSubscription();
  const { data, loading, error } = useEfficiencyFingerprint(isSubscribed ? activityId : null);

  if (!isSubscribed) {
    return (
      <Card className="glass-card border-glass-border mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            <span>Fingerprint de Eficiência</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-4">Análise exclusiva de eficiência por segmento</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Descubra onde você perde eficiência e receba recomendações personalizadas
            </p>
            <PremiumButton>Ver Fingerprint</PremiumButton>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="glass-card border-glass-border mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            <span>Fingerprint de Eficiência</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            <span className="text-sm text-muted-foreground">Calculando fingerprint de eficiência...</span>
          </div>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data || data.segments.length === 0) {
    return null; // Don't show if no data
  }

  return (
    <Card className="glass-card border-glass-border mb-8">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            <span>Fingerprint de Eficiência</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-primary">{data.overall_score}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Análise de eficiência por trecho de ~250m — pace vs potência vs FC
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Heatmap Grid */}
        <EfficiencyHeatmapGrid segments={data.segments} />

        {/* Synchronized Chart */}
        <EfficiencySyncChart segments={data.segments} />

        {/* Alerts */}
        {data.alerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Alertas detectados
            </h4>
            <div className="grid gap-2">
              {data.alerts.map((alert, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Badge variant={alert.severity === 'danger' ? 'destructive' : 'secondary'} className="mt-0.5 text-xs shrink-0">
                    km {alert.distance_km}
                  </Badge>
                  <span className="text-sm">{alert.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coach Recommendations */}
        {data.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Coach IA Recomenda
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.recommendations.map((rec, i) => (
                <div key={i} className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{rec.icon}</span>
                    <span className="font-medium text-sm">{rec.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
