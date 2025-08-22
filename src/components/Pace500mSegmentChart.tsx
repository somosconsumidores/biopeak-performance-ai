import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useActivityDetailsChart } from '@/hooks/useActivityDetailsChart';
import { useIsMobile } from '@/hooks/use-mobile';
import { BarChart3, Clock, RotateCcw } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Pace1kmSegmentChartProps {
  activityId: string | null;
  activityStartTime?: number | null;
  activityDate?: string | null;
}

interface SegmentData {
  segment: string;
  segmentNumber: number;
  avgPace: number;
  avgHeartRate: number;
  distance: number;
}

export const Pace1kmSegmentChart = ({ 
  activityId, 
  activityStartTime, 
  activityDate 
}: Pace1kmSegmentChartProps) => {
  const { data, loading, error, hasRawData, refetch } = useActivityDetailsChart(activityId);
  const isMobile = useIsMobile();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Clear cache if exists
      if (activityId) {
        const { error: deleteError } = await supabase
          .from('activity_chart_cache')
          .delete()
          .eq('activity_id', activityId);
        
        if (deleteError) {
          console.warn('Failed to clear cache:', deleteError.message);
        }
      }
      
      refetch();
      toast.success('Dados dos segmentos atualizados com sucesso');
    } catch (err) {
      console.error('Error refreshing segment data:', err);
      toast.error('Erro ao atualizar dados dos segmentos');
    } finally {
      setIsRefreshing(false);
    }
  };

  const segmentData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const segments: SegmentData[] = [];
    const segmentSize = 1000; // 1000 meters per segment

    // Group data by 1km segments
    let currentSegment = 1;
    let segmentStart = 0;
    let segmentPaceSum = 0;
    let segmentHRSum = 0;
    let segmentDataPoints = 0;

    for (const point of data) {
      const currentDistance = point.distance ? point.distance * 1000 : 0;
      
      // Check if we've reached the next 1km segment
      if (currentDistance >= currentSegment * segmentSize) {
        // Save current segment if we have data
        if (segmentDataPoints > 0) {
          segments.push({
            segment: `${(currentSegment - 1) * (segmentSize/1000) + 1}-${currentSegment * (segmentSize/1000)}km`,
            segmentNumber: currentSegment,
            avgPace: segmentPaceSum / segmentDataPoints,
            avgHeartRate: Math.round(segmentHRSum / segmentDataPoints),
            distance: currentSegment * segmentSize
          });
        }

        // Move to next segment
        currentSegment++;
        segmentPaceSum = 0;
        segmentHRSum = 0;
        segmentDataPoints = 0;
      }

      // Add current point to segment calculations
      if (point.pace && point.pace > 0) {
        segmentPaceSum += point.pace;
        segmentDataPoints++;
      }
      if (point.heart_rate && point.heart_rate > 0) {
        segmentHRSum += point.heart_rate;
      }
    }

    // Add final segment if we have data
    if (segmentDataPoints > 0) {
      segments.push({
        segment: `${(currentSegment - 1) * (segmentSize/1000) + 1}km+`,
        segmentNumber: currentSegment,
        avgPace: segmentPaceSum / segmentDataPoints,
        avgHeartRate: Math.round(segmentHRSum / segmentDataPoints),
        distance: currentSegment * segmentSize
      });
    }

    return segments;
  }, [data]);

  const formatPace = (pace: number) => {
    if (!pace || pace <= 0) return '--';
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const paceData = payload.find((p: any) => p.dataKey === 'avgPace');
      const hrData = payload.find((p: any) => p.dataKey === 'avgHeartRate');
      
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {paceData && (
            <p className="text-primary text-sm">
              <span className="inline-block w-3 h-3 bg-primary rounded mr-2"></span>
              Pace: {formatPace(paceData.value)}
            </p>
          )}
          {hrData && (
            <p className="text-sm" style={{ color: '#9333ea' }}>
              <span className="inline-block w-3 h-3 rounded mr-2" style={{ backgroundColor: '#9333ea' }}></span>
              FC: {hrData.value} bpm
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Análise por Segmentos (1km)</span>
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
              <span>Análise por Segmentos (1km)</span>
            </div>
            {(error || (!segmentData || segmentData.length === 0)) && hasRawData && (
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
            )}
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
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span>Análise por Segmentos (1km)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={segmentData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="segment"
                tick={{ fontSize: isMobile ? 10 : 12 }}
                interval={isMobile ? 1 : 0}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? 'end' : 'middle'}
                height={isMobile ? 60 : 40}
              />
              <YAxis 
                yAxisId="pace"
                orientation="left"
                tick={{ fontSize: isMobile ? 10 : 12 }}
                tickFormatter={(value) => formatPace(value)}
                domain={['dataMin - 0.2', 'dataMax + 0.2']}
              />
              <YAxis 
                yAxisId="hr"
                orientation="right"
                tick={{ fontSize: isMobile ? 10 : 12 }}
                tickFormatter={(value) => `${value}`}
                domain={['dataMin - 5', 'dataMax + 5']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: isMobile ? '12px' : '14px' }}
                iconType="rect"
              />
              <Bar 
                yAxisId="pace"
                dataKey="avgPace" 
                fill="hsl(var(--primary))" 
                name="Pace Médio" 
                opacity={0.8}
                radius={[2, 2, 0, 0]}
              />
              <Line 
                yAxisId="hr"
                type="monotone" 
                dataKey="avgHeartRate" 
                stroke="#9333ea" 
                name="FC Média"
                strokeWidth={2}
                dot={{ fill: '#9333ea', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, stroke: '#9333ea', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Information */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
              <div className="font-medium" style={{ color: '#9333ea' }}>
                {Math.round(segmentData.reduce((sum, seg) => sum + seg.avgHeartRate, 0) / segmentData.length)} bpm
              </div>
              <div className="text-muted-foreground">FC Média</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};