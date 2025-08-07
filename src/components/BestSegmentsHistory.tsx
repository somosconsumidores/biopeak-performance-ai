import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  Calendar, 
  Timer, 
  TrendingUp,
  TrendingDown,
  Minus,
  Activity
} from 'lucide-react';
import { useActivityBestSegments } from '@/hooks/useActivityBestSegments';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BestSegmentsHistoryProps {
  limit?: number;
  compact?: boolean;
}

export const BestSegmentsHistory = ({ limit = 5, compact = false }: BestSegmentsHistoryProps) => {
  const { user } = useAuth();
  const { 
    segments, 
    isLoading, 
    fetchUserSegments,
    formatPace,
    formatDuration 
  } = useActivityBestSegments();

  useEffect(() => {
    if (user?.id) {
      fetchUserSegments(user.id);
    }
  }, [user?.id]);

  const displaySegments = segments.slice(0, limit);

  // Calculate trend for each segment compared to previous one
  const getSegmentTrend = (currentSegment: any, index: number) => {
    if (index === segments.length - 1) return null; // Last segment (oldest)
    
    const nextSegment = segments[index + 1];
    if (!nextSegment?.best_1km_pace_min_km || !currentSegment.best_1km_pace_min_km) return null;
    
    const improvement = nextSegment.best_1km_pace_min_km - currentSegment.best_1km_pace_min_km;
    
    if (Math.abs(improvement) < 0.05) return 'same'; // Less than 3 seconds difference
    return improvement > 0 ? 'up' : 'down'; // 'up' means faster (better), 'down' means slower
  };

  if (isLoading) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <span>Histórico de Melhores Segmentos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando histórico...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (segments.length === 0) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <span>Histórico de Melhores Segmentos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum segmento calculado</h3>
            <p className="text-muted-foreground">
              Calcule segmentos nas suas atividades para ver o histórico aqui
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span>Melhores Segmentos</span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {segments.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {displaySegments.map((segment, index) => {
            const trend = getSegmentTrend(segment, index);
            
            return (
              <div 
                key={segment.id} 
                className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-muted"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-md bg-amber-500/20">
                    <Timer className="h-3 w-3 text-amber-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">
                      {formatPace(segment.best_1km_pace_min_km)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {segment.activity_date ? 
                        format(new Date(segment.activity_date), 'dd/MM', { locale: ptBR }) :
                        'Data N/A'
                      }
                    </div>
                  </div>
                </div>
                
                {trend && (
                  <div className="flex items-center space-x-1">
                    {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-400" />}
                    {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
                    {trend === 'same' && <Minus className="h-3 w-3 text-muted-foreground" />}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="h-5 w-5 text-amber-400" />
          <span>Histórico de Melhores Segmentos</span>
          <Badge variant="secondary" className="ml-auto">
            {segments.length} calculados
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displaySegments.map((segment, index) => {
            const trend = getSegmentTrend(segment, index);
            
            return (
              <div 
                key={segment.id} 
                className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <Trophy className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="font-semibold">
                        {formatPace(segment.best_1km_pace_min_km)}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center space-x-2">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {segment.activity_date ? 
                            format(new Date(segment.activity_date), 'dd \'de\' MMMM, yyyy', { locale: ptBR }) :
                            'Data não disponível'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {trend && (
                    <div className="flex items-center space-x-1">
                      {trend === 'up' && (
                        <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Melhor
                        </Badge>
                      )}
                      {trend === 'down' && (
                        <Badge variant="outline" className="border-red-500/30 text-red-400">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          Pior
                        </Badge>
                      )}
                      {trend === 'same' && (
                        <Badge variant="secondary">
                          <Minus className="h-3 w-3 mr-1" />
                          Similar
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Duração:</span>
                    <div className="font-medium">
                      {formatDuration(segment.segment_duration_seconds)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Início:</span>
                    <div className="font-medium">
                      {segment.segment_start_distance_meters ? 
                        `${(segment.segment_start_distance_meters / 1000).toFixed(2)}km` : 
                        'N/A'
                      }
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fim:</span>
                    <div className="font-medium">
                      {segment.segment_end_distance_meters ? 
                        `${(segment.segment_end_distance_meters / 1000).toFixed(2)}km` : 
                        'N/A'
                      }
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};