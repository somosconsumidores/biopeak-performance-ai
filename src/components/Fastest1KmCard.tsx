import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, Timer, MapPin } from 'lucide-react';
import { useFastest1KmSegment, formatPace, formatDistance, formatDuration } from '@/hooks/useFastest1KmSegment';

interface Fastest1KmCardProps {
  activityId: string;
  activitySource?: string;
  compact?: boolean;
}

export function Fastest1KmCard({ 
  activityId, 
  activitySource = 'garmin',
  compact = false 
}: Fastest1KmCardProps) {
  const { segment, loading, error, refetch } = useFastest1KmSegment(activityId, activitySource);

  if (compact) {
    return (
      <Card className="bg-card">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">1km Mais Rápido</span>
            </div>
            {loading ? (
              <div className="h-6 w-6 animate-spin">
                <RefreshCw className="h-4 w-4" />
              </div>
            ) : segment ? (
              <Badge variant="secondary" className="font-mono">
                {formatPace(segment.avg_pace_min_km)}
              </Badge>
            ) : (
              <Button 
                onClick={refetch} 
                size="sm" 
                variant="outline"
                disabled={loading}
              >
                Analisar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Segmento de 1km Mais Rápido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">
              Analisando atividade...
            </span>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button 
              onClick={refetch} 
              size="sm" 
              variant="outline"
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        )}

        {!loading && !error && !segment && (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">
              Nenhum segmento encontrado
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Não foi possível encontrar um segmento de 1km completo nesta atividade.
            </p>
            <Button 
              onClick={refetch} 
              size="sm" 
              variant="outline"
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reanalisar
            </Button>
          </div>
        )}

        {segment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary/50 rounded-lg p-4 text-center">
                <Timer className="h-5 w-5 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold text-foreground font-mono">
                  {formatPace(segment.avg_pace_min_km)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Pace Médio
                </div>
              </div>
              
              <div className="bg-secondary/50 rounded-lg p-4 text-center">
                <MapPin className="h-5 w-5 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold text-foreground">
                  {formatDuration(segment.duration_seconds)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Duração
                </div>
              </div>
            </div>

            <div className="bg-secondary/30 rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-3">Detalhes do Segmento</h4>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Início:</span>
                  <span className="font-medium">{formatDistance(segment.start_distance_m)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fim:</span>
                  <span className="font-medium">{formatDistance(segment.end_distance_m)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comprimento:</span>
                  <span className="font-medium">{formatDistance(segment.segment_length_m)}</span>
                </div>
              </div>
            </div>

            <Button 
              onClick={refetch} 
              size="sm" 
              variant="outline" 
              className="w-full"
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Recalcular Segmento
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}