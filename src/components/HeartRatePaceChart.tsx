import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Heart, Timer, AlertCircle } from 'lucide-react';
import { useActivityDetailsChart } from '@/hooks/useActivityDetailsChart';

interface HeartRatePaceChartProps {
  activityId: string | null;
}

export const HeartRatePaceChart = ({ activityId }: HeartRatePaceChartProps) => {
  const { data, loading, error, hasData } = useActivityDetailsChart(activityId);

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
          <CardTitle className="flex items-center space-x-2">
            <Heart className="h-5 w-5 text-primary" />
            <span>Evolução do Ritmo e Frequência Cardíaca</span>
          </CardTitle>
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

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const minutes = Math.floor(data.pace_min_per_km || 0);
      const seconds = Math.round(((data.pace_min_per_km || 0) - minutes) * 60);
      const paceDisplay = data.pace_min_per_km && data.pace_min_per_km > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}/km` : "Parado";
      
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{`Distância: ${data.distance_km.toFixed(2)}km`}</p>
          <p className="text-sm font-medium">{`Ritmo: ${paceDisplay}`}</p>
          <p className="text-sm font-medium">{`FC: ${data.heart_rate} bpm`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Heart className="h-5 w-5 text-primary" />
          <span>Evolução do Ritmo e Frequência Cardíaca</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={data} 
              margin={{ 
                top: 10, 
                right: window.innerWidth < 768 ? 10 : 30, 
                left: window.innerWidth < 768 ? 10 : 20, 
                bottom: 10 
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="distance_km" 
                type="number"
                domain={[0, 'dataMax']}
                tickFormatter={(value) => `${value.toFixed(1)}km`}
                fontSize={window.innerWidth < 768 ? 10 : 12}
                tick={{ fontSize: window.innerWidth < 768 ? 10 : 12 }}
              />
              <YAxis 
                yAxisId="pace"
                dataKey="pace_min_per_km"
                domain={['dataMin - 0.2', 'dataMax + 0.2']}
                tickFormatter={(value) => {
                  if (value === null || value === undefined) return '';
                  const minutes = Math.floor(value);
                  const seconds = Math.round((value - minutes) * 60);
                  return window.innerWidth < 768 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }}
                stroke="hsl(var(--primary))"
                fontSize={window.innerWidth < 768 ? 10 : 12}
                tick={{ fontSize: window.innerWidth < 768 ? 10 : 12 }}
                width={window.innerWidth < 768 ? 35 : 45}
              />
              <YAxis 
                yAxisId="hr"
                orientation="right"
                domain={['dataMin - 10', 'dataMax + 10']}
                tickFormatter={(value) => window.innerWidth < 768 ? `${Math.round(value)}` : `${Math.round(value)} bpm`}
                stroke="hsl(var(--secondary))"
                fontSize={window.innerWidth < 768 ? 10 : 12}
                tick={{ fontSize: window.innerWidth < 768 ? 10 : 12 }}
                width={window.innerWidth < 768 ? 30 : 45}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Reference lines for averages - hide on mobile for clarity */}
              {avgPace > 0 && window.innerWidth >= 768 && (
                <ReferenceLine 
                  yAxisId="pace"
                  y={avgPace} 
                  stroke="hsl(var(--primary))" 
                  strokeDasharray="5 5" 
                  strokeOpacity={0.5}
                  label={{ value: "Ritmo Médio", position: "top", fontSize: 10 }}
                />
              )}
              {window.innerWidth >= 768 && (
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
                strokeWidth={window.innerWidth < 768 ? 1.5 : 2}
                dot={false}
                activeDot={{ r: window.innerWidth < 768 ? 3 : 4, fill: "hsl(var(--primary))" }}
                name="Ritmo"
                connectNulls={false}
              />
              <Line 
                yAxisId="hr"
                type="monotone" 
                dataKey="heart_rate" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={window.innerWidth < 768 ? 1.5 : 2}
                dot={false}
                activeDot={{ r: window.innerWidth < 768 ? 3 : 4, fill: "hsl(var(--secondary))" }}
                name="Frequência Cardíaca"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
          <div className="flex items-center space-x-2 justify-center sm:justify-start">
            <div className="w-3 h-0.5 bg-primary rounded"></div>
            <span className="truncate">Ritmo: {avgPace > 0 ? `${Math.floor(avgPace)}:${Math.round((avgPace - Math.floor(avgPace)) * 60).toString().padStart(2, '0')}/km` : 'N/A'}</span>
          </div>
          <div className="flex items-center space-x-2 justify-center sm:justify-start">
            <div className="w-3 h-0.5 bg-secondary rounded"></div>
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