import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Timer, AlertCircle } from 'lucide-react';
import { useStravaActivityChart } from '@/hooks/useStravaActivityChart';
import { useScreenSize } from '@/hooks/use-mobile';

interface StravaPaceChartProps {
  stravaActivityId: number | null;
}

export const StravaPaceChart = ({ stravaActivityId }: StravaPaceChartProps) => {
  const { data, loading, error, hasData } = useStravaActivityChart(stravaActivityId);
  const { isMobile, isTablet } = useScreenSize();

  // Custom tooltip otimizado para mobile e com FC
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const minutes = Math.floor(d.pace_min_per_km || 0);
      const seconds = Math.round(((d.pace_min_per_km || 0) - minutes) * 60);
      const paceDisplay = d.pace_min_per_km && d.pace_min_per_km > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}/km` : 'Parado';

      return (
        <div className={`bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg ${
          isMobile ? 'p-2 max-w-[200px]' : 'p-3'
        }`}>
          <p className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {isMobile ? `${d.distance_km.toFixed(1)}km` : `Distância: ${d.distance_km.toFixed(2)}km`}
          </p>
          <p className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {isMobile ? paceDisplay : `Ritmo: ${paceDisplay}`}
          </p>
          <p className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {`FC: ${d.heart_rate ?? 'N/A'} bpm`}
          </p>
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
            <Timer className="h-5 w-5 text-primary" />
            <span>Evolução do Ritmo (Strava)</span>
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
          <CardTitle className="flex items-center space-x-2">
            <Timer className="h-5 w-5 text-primary" />
            <span>Evolução do Ritmo (Strava)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Dados não disponíveis</h3>
              <p className="text-muted-foreground">
                Esta atividade não possui dados detalhados de ritmo do Strava.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ritmo médio para linha de referência
  const validPaceData = data.filter((item) => item.pace_min_per_km !== null && item.pace_min_per_km > 0);
  const avgPace = validPaceData.length > 0 ? validPaceData.reduce((sum, item) => sum + item.pace_min_per_km!, 0) / validPaceData.length : 0;

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Timer className="h-5 w-5 text-primary" />
          <span>Evolução do Ritmo (Strava)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`${isMobile ? 'h-64' : 'h-72 sm:h-80'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 10,
                right: isMobile ? 20 : isTablet ? 26 : 36,
                left: isMobile ? 15 : isTablet ? 20 : 25,
                bottom: isMobile ? 15 : 20,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="distance_km"
                type="number"
                domain={[0, 'dataMax']}
                tickFormatter={(value) => (isMobile ? `${value.toFixed(0)}km` : `${value.toFixed(1)}km`)}
                fontSize={isMobile ? 9 : 12}
                tick={{ fontSize: isMobile ? 9 : 12 }}
                interval={isMobile ? 'preserveStartEnd' : 0}
              />
              <YAxis
                dataKey="pace_min_per_km"
                domain={['dataMin - 0.2', 'dataMax + 0.2']}
                tickFormatter={(value) => {
                  if (value === null || value === undefined) return '';
                  const minutes = Math.floor(value);
                  const seconds = Math.round((value - minutes) * 60);
                  return isMobile ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
                }}
                stroke="hsl(var(--primary))"
                fontSize={isMobile ? 9 : 12}
                tick={{ fontSize: isMobile ? 9 : 12 }}
                width={isMobile ? 50 : 60}
              />
              <YAxis
                yAxisId="hr"
                orientation="right"
                allowDecimals={false}
                domain={['dataMin - 5', 'dataMax + 5']}
                stroke="hsl(var(--muted-foreground))"
                fontSize={isMobile ? 9 : 12}
                tick={{ fontSize: isMobile ? 9 : 12 }}
                width={isMobile ? 40 : 50}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Linha de referência para ritmo médio (oculta no mobile) */}
              {avgPace > 0 && !isMobile && (
                <ReferenceLine
                  y={avgPace}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="5 5"
                  strokeOpacity={0.5}
                  label={{ value: 'Ritmo Médio', position: 'top', fontSize: 10 }}
                />
              )}

              <Line
                type="monotone"
                dataKey="pace_min_per_km"
                stroke="hsl(var(--primary))"
                strokeWidth={isMobile ? 2 : 3}
                dot={false}
                activeDot={{ r: isMobile ? 4 : 5, fill: 'hsl(var(--primary))' }}
                name="Ritmo"
                connectNulls={false}
              />
              <Line
                type="monotone"
                yAxisId="hr"
                dataKey="heart_rate"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={isMobile ? 1.5 : 2}
                dot={false}
                activeDot={{ r: isMobile ? 3.5 : 4, fill: 'hsl(var(--muted-foreground))' }}
                name="FC"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={`mt-4 grid gap-2 ${isMobile ? 'grid-cols-1 text-xs' : 'grid-cols-1 sm:grid-cols-2 text-xs sm:text-sm'}`}>
          <div className="flex items-center space-x-2 justify-center sm:justify-start">
            <div className="w-3 h-0.5 bg-primary rounded flex-shrink-0"></div>
            <span className="truncate">
              Ritmo Médio: {avgPace > 0 ? `${Math.floor(avgPace)}:${Math.round((avgPace - Math.floor(avgPace)) * 60).toString().padStart(2, '0')}/km` : 'N/A'}
            </span>
          </div>
          <div className="text-muted-foreground text-center sm:text-left">
            <span className="truncate">Distância Total: {data.length > 0 ? data[data.length - 1].distance_km.toFixed(1) : 0}km</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
