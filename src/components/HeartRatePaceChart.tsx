
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Heart, Timer, AlertCircle, Download } from 'lucide-react';
import { useActivityDetailsChart } from '@/hooks/useActivityDetailsChart';
import { useScreenSize } from '@/hooks/use-mobile';
import { useGarminActivityDetails } from '@/hooks/useGarminActivityDetails';
import { useState } from 'react';
import { toast } from 'sonner';

interface HeartRatePaceChartProps {
  activityId: string | null;
  activityStartTime?: number | null;
  activityDate?: string | null;
}

export const HeartRatePaceChart = ({ activityId, activityStartTime, activityDate }: HeartRatePaceChartProps) => {
  const { data, loading, error, hasData, hasRawData } = useActivityDetailsChart(activityId);
  const { isMobile, isTablet } = useScreenSize();
  const { syncActivityDetails, isLoading: isSyncing } = useGarminActivityDetails();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Helper function to calculate proper timestamp range
  const calculateTimestampRange = (startTime: number | null, dateString: string | null) => {
    console.log('🔍 TIMESTAMP INPUT:', { startTime, dateString });
    
    let baseDate: Date;
    
    // If we have activity_date, use it as the primary reference
    if (dateString) {
      // Parse the date string (YYYY-MM-DD format) and create a date in local timezone
      const [year, month, day] = dateString.split('-').map(Number);
      baseDate = new Date(year, month - 1, day); // month is 0-indexed
      console.log('🔍 Using activity_date as base:', baseDate.toISOString());
    } 
    // Fallback to start_time_in_seconds if it's reasonable (not in the future)
    else if (startTime) {
      const currentTime = Date.now() / 1000;
      const oneYearFromNow = currentTime + (365 * 24 * 60 * 60); // 1 year in the future
      
      if (startTime > oneYearFromNow) {
        console.warn('🔍 start_time_in_seconds is too far in the future, using current date as fallback');
        baseDate = new Date();
      } else {
        baseDate = new Date(startTime * 1000);
        console.log('🔍 Using start_time_in_seconds as base:', baseDate.toISOString());
      }
    } 
    // Ultimate fallback to current date
    else {
      baseDate = new Date();
      console.log('🔍 Using current date as fallback:', baseDate.toISOString());
    }
    
    // Calculate start of day in local timezone
    const startOfDay = new Date(baseDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    // Calculate end of day in local timezone  
    const endOfDay = new Date(baseDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const startTimeSeconds = Math.floor(startOfDay.getTime() / 1000);
    const endTimeSeconds = Math.floor(endOfDay.getTime() / 1000);
    
    console.log('🔍 CALCULATED RANGE:', {
      baseDate: baseDate.toISOString(),
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
      startTimeSeconds,
      endTimeSeconds,
      startTimeDate: new Date(startTimeSeconds * 1000).toISOString(),
      endTimeDate: new Date(endTimeSeconds * 1000).toISOString()
    });
    
    return { startTimeSeconds, endTimeSeconds };
  };

  console.log('🔍 BUTTON DEBUG:', { 
    hasRawData, 
    activityStartTime, 
    activityDate,
    activityId,
    shouldShowButton: !hasRawData && (!!activityStartTime || !!activityDate)
  });

  if (loading) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Heart className="h-5 w-5 text-primary" />
            <span>Evolução do Ritmo e Frequência Cardíaca</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !hasData) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Heart className="h-5 w-5 text-primary" />
              <span>Evolução do Ritmo e Frequência Cardíaca</span>
            </CardTitle>
            {!hasRawData && (activityStartTime || activityDate) && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    const { startTimeSeconds, endTimeSeconds } = calculateTimestampRange(activityStartTime, activityDate);
                    
                    const success = await syncActivityDetails({
                      uploadStartTimeInSeconds: startTimeSeconds,
                      uploadEndTimeInSeconds: endTimeSeconds
                    });
                    
                    if (success) {
                      toast.success('Dados detalhados sincronizados com sucesso!');
                      // Force a page refresh to reload the chart data
                      window.location.reload();
                    } else {
                      toast.error('Erro ao sincronizar dados detalhados');
                    }
                  } catch (error) {
                    console.error('Error syncing activity details:', error);
                    toast.error('Erro ao sincronizar dados detalhados');
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                disabled={isSyncing || isRefreshing}
                className="glass-card border-glass-border"
              >
                <Download className="h-4 w-4 mr-2" />
                {isRefreshing ? 'Sincronizando...' : 'Sincronizar Dados'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Dados não disponíveis</h3>
              <p className="text-muted-foreground">
                Esta atividade não possui dados detalhados de frequência cardíaca e ritmo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate average values for reference lines (excluding null values for pace)
  const validPaceData = data.filter(item => item.pace_min_per_km !== null && item.pace_min_per_km > 0);
  const avgHeartRate = data.reduce((sum, item) => sum + item.heart_rate, 0) / data.length;
  const avgPace = validPaceData.length > 0 ? validPaceData.reduce((sum, item) => sum + item.pace_min_per_km!, 0) / validPaceData.length : 0;

  // Custom tooltip optimized for mobile
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const minutes = Math.floor(data.pace_min_per_km || 0);
      const seconds = Math.round(((data.pace_min_per_km || 0) - minutes) * 60);
      const paceDisplay = data.pace_min_per_km && data.pace_min_per_km > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}/km` : "Parado";
      
      return (
        <div className={`bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg ${
          isMobile ? 'p-2 max-w-[200px]' : 'p-3'
        }`}>
          <p className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {isMobile ? `${data.distance_km.toFixed(1)}km` : `Distância: ${data.distance_km.toFixed(2)}km`}
          </p>
          <p className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {isMobile ? paceDisplay : `Ritmo: ${paceDisplay}`}
          </p>
          <p className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {isMobile ? `${data.heart_rate} bpm` : `FC: ${data.heart_rate} bpm`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="glass-card border-glass-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Heart className="h-5 w-5 text-primary" />
              <span>Evolução do Ritmo e Frequência Cardíaca</span>
            </CardTitle>
            {!hasRawData && (activityStartTime || activityDate) && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    const { startTimeSeconds, endTimeSeconds } = calculateTimestampRange(activityStartTime, activityDate);
                    
                    const success = await syncActivityDetails({
                      uploadStartTimeInSeconds: startTimeSeconds,
                      uploadEndTimeInSeconds: endTimeSeconds
                    });
                    
                    if (success) {
                      toast.success('Dados detalhados sincronizados com sucesso!');
                      // Force a page refresh to reload the chart data
                      window.location.reload();
                    } else {
                      toast.error('Erro ao sincronizar dados detalhados');
                    }
                  } catch (error) {
                    console.error('Error syncing activity details:', error);
                    toast.error('Erro ao sincronizar dados detalhados');
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                disabled={isSyncing || isRefreshing}
                className="glass-card border-glass-border"
              >
                <Download className="h-4 w-4 mr-2" />
                {isRefreshing ? 'Sincronizando...' : 'Sincronizar Dados'}
              </Button>
            )}
          </div>
        </CardHeader>
      <CardContent>
        <div className={`${isMobile ? 'h-64' : 'h-72 sm:h-80'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={data} 
              margin={{ 
                top: 10, 
                right: isMobile ? 15 : (isTablet ? 20 : 30), 
                left: isMobile ? 15 : (isTablet ? 20 : 25), 
                bottom: isMobile ? 15 : 20 
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="distance_km" 
                type="number"
                domain={[0, 'dataMax']}
                tickFormatter={(value) => isMobile ? `${value.toFixed(0)}km` : `${value.toFixed(1)}km`}
                fontSize={isMobile ? 9 : 12}
                tick={{ fontSize: isMobile ? 9 : 12 }}
                interval={isMobile ? 'preserveStartEnd' : 0}
              />
              <YAxis 
                yAxisId="pace"
                dataKey="pace_min_per_km"
                domain={['dataMin - 0.2', 'dataMax + 0.2']}
                tickFormatter={(value) => {
                  if (value === null || value === undefined) return '';
                  const minutes = Math.floor(value);
                  const seconds = Math.round((value - minutes) * 60);
                  return isMobile ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }}
                stroke="hsl(var(--primary))"
                fontSize={isMobile ? 9 : 12}
                tick={{ fontSize: isMobile ? 9 : 12 }}
                width={isMobile ? 40 : 50}
              />
              <YAxis 
                yAxisId="hr"
                orientation="right"
                domain={['dataMin - 10', 'dataMax + 10']}
                tickFormatter={(value) => isMobile ? `${Math.round(value)}` : `${Math.round(value)} bpm`}
                stroke="hsl(var(--secondary))"
                fontSize={isMobile ? 9 : 12}
                tick={{ fontSize: isMobile ? 9 : 12 }}
                width={isMobile ? 35 : 50}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Reference lines for averages - hide on mobile for clarity */}
              {avgPace > 0 && !isMobile && (
                <ReferenceLine 
                  yAxisId="pace"
                  y={avgPace} 
                  stroke="hsl(var(--primary))" 
                  strokeDasharray="5 5" 
                  strokeOpacity={0.5}
                  label={{ value: "Ritmo Médio", position: "top", fontSize: 10 }}
                />
              )}
              {!isMobile && (
                <ReferenceLine 
                  yAxisId="hr"
                  y={avgHeartRate} 
                  stroke="hsl(var(--secondary))" 
                  strokeDasharray="5 5" 
                  strokeOpacity={0.5}
                  label={{ value: "FC Média", position: "top", fontSize: 10 }}
                />
              )}
              
              <Line 
                yAxisId="pace"
                type="monotone" 
                dataKey="pace_min_per_km" 
                stroke="hsl(var(--primary))" 
                strokeWidth={isMobile ? 1.5 : 2}
                dot={false}
                activeDot={{ r: isMobile ? 3 : 4, fill: "hsl(var(--primary))" }}
                name="Ritmo"
                connectNulls={false}
              />
              <Line 
                yAxisId="hr"
                type="monotone" 
                dataKey="heart_rate" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={isMobile ? 1.5 : 2}
                dot={false}
                activeDot={{ r: isMobile ? 3 : 4, fill: "hsl(var(--secondary))" }}
                name="Frequência Cardíaca"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className={`mt-4 grid gap-2 ${isMobile ? 'grid-cols-1 text-xs' : 'grid-cols-1 sm:grid-cols-3 text-xs sm:text-sm'}`}>
          <div className="flex items-center space-x-2 justify-center sm:justify-start">
            <div className="w-3 h-0.5 bg-primary rounded flex-shrink-0"></div>
            <span className="truncate">Ritmo: {avgPace > 0 ? `${Math.floor(avgPace)}:${Math.round((avgPace - Math.floor(avgPace)) * 60).toString().padStart(2, '0')}/km` : 'N/A'}</span>
          </div>
          <div className="flex items-center space-x-2 justify-center sm:justify-start">
            <div className="w-3 h-0.5 bg-secondary rounded flex-shrink-0"></div>
            <span className="truncate">FC: {Math.round(avgHeartRate)} bpm</span>
          </div>
          <div className="text-muted-foreground text-center sm:text-left">
            <span className="truncate">Distância: {data.length > 0 ? data[data.length - 1].distance_km.toFixed(1) : 0}km</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
