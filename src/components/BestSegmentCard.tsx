import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Timer, 
  Trophy, 
  MapPin, 
  Play, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';
import { useActivityBestSegments } from '@/hooks/useActivityBestSegments';
import { useAuth } from '@/hooks/useAuth';

interface BestSegmentCardProps {
  activityId: string;
  compact?: boolean;
}

export const BestSegmentCard = ({ activityId, compact = false }: BestSegmentCardProps) => {
  const { user } = useAuth();
  const { 
    isCalculating, 
    segments, 
    calculateBestSegment, 
    getSegmentByActivity,
    formatPace,
    formatDuration,
    fetchUserSegments
  } = useActivityBestSegments();

  // Load user segments when component mounts
  useEffect(() => {
    if (user?.id) {
      fetchUserSegments(user.id);
    }
  }, [user?.id, fetchUserSegments]);

  const segment = getSegmentByActivity(activityId);

  // Debug log
  console.log('🔍 BEST SEGMENT CARD DEBUG:', {
    activityId,
    segment,
    allSegments: segments,
    segmentsCount: segments.length,
    userId: user?.id
  });

  const handleCalculate = async () => {
    if (!user?.id) return;
    await calculateBestSegment(activityId, user.id);
  };

  if (compact) {
    return (
      <Card className="glass-card border-glass-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Trophy className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Melhor 1km</h3>
                {segment ? (
                  <p className="text-xs text-muted-foreground">
                    {formatPace(segment.best_1km_pace_min_km)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Não calculado</p>
                )}
              </div>
            </div>
            
            {!segment && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleCalculate}
                disabled={isCalculating}
                className="h-8 px-3"
              >
                {isCalculating ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="h-5 w-5 text-amber-400" />
          <span>Melhor Segmento 1km</span>
          {segment && (
            <Badge variant="default" className="ml-auto">
              Calculado
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {segment ? (
          <div className="space-y-4">
            {/* Main Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Timer className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-amber-400">
                  {formatPace(segment.best_1km_pace_min_km)}
                </div>
                <div className="text-xs text-muted-foreground">Pace</div>
              </div>
              
              <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Timer className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-400">
                  {formatDuration(segment.segment_duration_seconds)}
                </div>
                <div className="text-xs text-muted-foreground">Duração</div>
              </div>
            </div>

            {/* Segment Details */}
            <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-muted">
              <h4 className="font-semibold text-sm flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>Detalhes do Segmento</span>
              </h4>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Início:</span>
                  <span className="ml-2 font-medium">
                    {segment.segment_start_distance_meters ? 
                      `${(segment.segment_start_distance_meters / 1000).toFixed(2)}km` : 
                      'N/A'
                    }
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fim:</span>
                  <span className="ml-2 font-medium">
                    {segment.segment_end_distance_meters ? 
                      `${(segment.segment_end_distance_meters / 1000).toFixed(2)}km` : 
                      'N/A'
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Recalculate Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCalculate}
              disabled={isCalculating}
              className="w-full"
            >
              {isCalculating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Recalculando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recalcular Segmento
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Segmento não calculado</h3>
            <p className="text-muted-foreground mb-4">
              Calcule o melhor segmento de 1km desta atividade
            </p>
            <Button 
              onClick={handleCalculate}
              disabled={isCalculating}
              className="min-w-[160px]"
            >
              {isCalculating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Calculando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Calcular Segmento
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};