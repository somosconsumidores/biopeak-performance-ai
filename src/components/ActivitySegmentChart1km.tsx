import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, RotateCcw } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ActivitySegmentChart1kmProps {
  activityId: string;
}

interface SegmentData {
  segment: string;
  segmentNumber: number;
  avgPace: number;
  avgHeartRate: number;
  distance: number;
  cumulativeTime: number; // in seconds
  segmentTime: number; // in seconds
}

interface ActivityData {
  activity_id: string;
  activity_source: string;
  series_data: any[];
  avg_pace_min_km?: number;
  avg_heart_rate?: number;
}

export const ActivitySegmentChart1km = ({ activityId }: ActivitySegmentChart1kmProps) => {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [segmentSize, setSegmentSize] = useState<1 | 5>(1); // 1km or 5km segments

  const fetchData = async () => {
    if (!activityId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const { data: activityData, error: fetchError } = await supabase
        .from('activity_chart_data')
        .select('activity_id, activity_source, series_data, avg_pace_min_km, avg_heart_rate')
        .eq('activity_id', activityId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          throw new Error('Atividade não encontrada na tabela activity_chart_data');
        }
        throw fetchError;
      }

      if (!activityData) {
        throw new Error('Dados da atividade não encontrados');
      }

      setData(activityData);
    } catch (err: any) {
      console.error('Error fetching activity data:', err);
      setError(err.message || 'Erro ao buscar dados da atividade');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [activityId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
      toast.success('Dados dos segmentos atualizados com sucesso');
    } catch (err) {
      console.error('Error refreshing segment data:', err);
      toast.error('Erro ao atualizar dados dos segmentos');
    } finally {
      setIsRefreshing(false);
    }
  };

  const segmentData = useMemo(() => {
    if (!data || !data.series_data || data.series_data.length === 0) return [];

    const segments: SegmentData[] = [];
    const segmentSizeMeters = segmentSize * 1000; // Convert km to meters

    // Group data by selected segment size
    let currentSegment = 1;
    let segmentPaceSum = 0;
    let segmentHRSum = 0;
    let segmentDataPoints = 0;
    let segmentHRPoints = 0;
    let lastSegmentEndTime = 0;
    let segmentStartTime = 0;

    for (const point of data.series_data) {
      const currentDistance = point.distance_m || 0;
      const currentTime = point.timestamp || point.elapsed_time || 0;
      
      // Check if we've reached the next segment
      if (currentDistance >= currentSegment * segmentSizeMeters) {
        // Save current segment if we have data
        if (segmentDataPoints > 0) {
          const segmentTime = currentTime - segmentStartTime;
          const startKm = (currentSegment - 1) * segmentSize + 1;
          const endKm = currentSegment * segmentSize;
          
          segments.push({
            segment: segmentSize === 1 ? `${currentSegment}km` : `${startKm}-${endKm}km`,
            segmentNumber: currentSegment,
            avgPace: segmentPaceSum / segmentDataPoints,
            avgHeartRate: segmentHRPoints > 0 ? Math.round(segmentHRSum / segmentHRPoints) : 0,
            distance: currentSegment * segmentSizeMeters,
            cumulativeTime: currentTime,
            segmentTime: segmentTime
          });
          lastSegmentEndTime = currentTime;
        }

        // Move to next segment
        currentSegment++;
        segmentPaceSum = 0;
        segmentHRSum = 0;
        segmentDataPoints = 0;
        segmentHRPoints = 0;
        segmentStartTime = lastSegmentEndTime;
      }

      // Add current point to segment calculations
      const pace = point.pace_min_km;
      const heartRate = point.heart_rate || point.hr;

      if (pace && pace > 0) {
        segmentPaceSum += pace;
        segmentDataPoints++;
      }
      if (heartRate && heartRate > 0) {
        segmentHRSum += heartRate;
        segmentHRPoints++;
      }
    }

    // Add final segment if we have data
    if (segmentDataPoints > 0) {
      const finalPoint = data.series_data[data.series_data.length - 1];
      const finalTime = finalPoint?.timestamp || finalPoint?.elapsed_time || 0;
      const segmentTime = finalTime - segmentStartTime;
      const startKm = (currentSegment - 1) * segmentSize + 1;
      const endKm = currentSegment * segmentSize;
      
      segments.push({
        segment: segmentSize === 1 ? `${currentSegment}km` : `${startKm}-${endKm}km`,
        segmentNumber: currentSegment,
        avgPace: segmentPaceSum / segmentDataPoints,
        avgHeartRate: segmentHRPoints > 0 ? Math.round(segmentHRSum / segmentHRPoints) : 0,
        distance: finalPoint?.distance_m || 0,
        cumulativeTime: finalTime,
        segmentTime: segmentTime
      });
    }

    return segments;
  }, [data, segmentSize]);

  const formatPace = (pace: number) => {
    if (!pace || pace <= 0) return '--';
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}"`;
  };

  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const decimals = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${decimals.toString().padStart(2, '0')}`;
  };

  const getProgressWidth = (pace: number, minPace: number, maxPace: number) => {
    if (!pace || !minPace || !maxPace) return 0;
    // Invert the calculation because lower pace is better
    const range = maxPace - minPace;
    if (range === 0) return 50;
    const relativePosition = (maxPace - pace) / range;
    return Math.max(10, Math.min(90, relativePosition * 80 + 10));
  };

  // Calculate pace range for progress bars
  const paceRange = useMemo(() => {
    if (!segmentData || segmentData.length === 0) return { min: 0, max: 0 };
    const paces = segmentData.filter(s => s.avgPace > 0).map(s => s.avgPace);
    return {
      min: Math.min(...paces),
      max: Math.max(...paces)
    };
  }, [segmentData]);

  // Find the index of the fastest segment (lowest pace)
  const fastestSegmentIndex = useMemo(() => {
    if (!segmentData || segmentData.length === 0) return -1;
    const validSegments = segmentData.filter(s => s.avgPace > 0);
    if (validSegments.length === 0) return -1;
    
    const minPace = Math.min(...validSegments.map(s => s.avgPace));
    return segmentData.findIndex(s => s.avgPace === minPace);
  }, [segmentData]);

  if (loading) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Análise por Segmentos (1km) - Activity Chart Data</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !segmentData || segmentData.length === 0) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span>Análise por Segmentos (1km) - Activity Chart Data</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1"
            >
              <RotateCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            {error ? `Erro: ${error}` : 'Dados não disponíveis para análise por segmentos'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Análise por Segmentos (1km) - Activity Chart Data</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-sm text-muted-foreground">
              Fonte: {data?.activity_source?.toUpperCase()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1"
            >
              <RotateCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Tab-style header */}
        <div className="mb-4">
          <div className="flex items-center space-x-6 mb-2">
            <div className="flex items-center space-x-1">
              <span className="text-sm font-medium text-primary border-b-2 border-primary pb-1">Detalhes por km</span>
            </div>
          </div>
          
          {/* Segment selection buttons */}
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-sm text-muted-foreground">{segmentData.length} registros</span>
            <div className="flex-1"></div>
            <div className="flex items-center space-x-2">
              <Button 
                variant={segmentSize === 1 ? "default" : "ghost"} 
                size="sm" 
                className="px-3 py-1 text-xs"
                onClick={() => setSegmentSize(1)}
              >
                1 km
              </Button>
              <Button 
                variant={segmentSize === 5 ? "default" : "ghost"} 
                size="sm" 
                className={`px-3 py-1 text-xs ${segmentSize === 5 ? '' : 'text-muted-foreground'}`}
                onClick={() => setSegmentSize(5)}
              >
                5 km
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs font-medium text-muted-foreground py-2 px-2">{segmentSize === 1 ? 'km' : 'Segmento'}</th>
                <th className="text-left text-xs font-medium text-muted-foreground py-2 px-2">Ritmo(km)</th>
                <th className="text-left text-xs font-medium text-muted-foreground py-2 px-2">Ritmo cardíaco</th>
                <th className="text-left text-xs font-medium text-muted-foreground py-2 px-2">Tempo</th>
              </tr>
            </thead>
            <tbody>
              {segmentData.map((segment, index) => (
                <tr key={segment.segmentNumber} className="border-b border-border/30 hover:bg-muted/30">
                  <td className="py-3 px-2">
                    <div className="flex items-center">
                      {index === fastestSegmentIndex && (
                        <div className="w-0 h-0 border-l-[6px] border-l-green-500 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent mr-2"></div>
                      )}
                      <span className="text-sm font-medium">{segmentSize === 1 ? segment.segmentNumber : segment.segment}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center space-x-3 min-w-[120px]">
                      <span className="text-sm font-medium w-12">{formatPace(segment.avgPace)}</span>
                      <div className="flex-1 bg-muted rounded-full h-2 relative">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            index === fastestSegmentIndex ? 'bg-green-500' : 'bg-blue-400'
                          }`}
                          style={{ 
                            width: `${getProgressWidth(segment.avgPace, paceRange.min, paceRange.max)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-sm">{segment.avgHeartRate > 0 ? segment.avgHeartRate : '--'}</span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-sm">{formatTime(segment.cumulativeTime)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Summary Information */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-primary">{segmentData.length}</div>
              <div className="text-muted-foreground">Segmentos</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-primary">
                {formatPace(segmentData.reduce((sum, seg) => sum + seg.avgPace, 0) / segmentData.length)}
              </div>
              <div className="text-muted-foreground">Pace Médio</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-[#9333ea]">
                {Math.round(segmentData.filter(s => s.avgHeartRate > 0).reduce((sum, seg) => sum + seg.avgHeartRate, 0) / segmentData.filter(s => s.avgHeartRate > 0).length) || 0} bpm
              </div>
              <div className="text-muted-foreground">FC Média</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-muted-foreground">{data?.series_data?.length || 0}</div>
              <div className="text-muted-foreground">Pontos de Dados</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};