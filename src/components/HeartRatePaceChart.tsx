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
            <span>Frequência Cardíaca vs Ritmo</span>
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
            <span>Frequência Cardíaca vs Ritmo</span>
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

  // Calculate average values for reference lines
  const avgHeartRate = data.reduce((sum, item) => sum + item.heart_rate, 0) / data.length;
  const avgPace = data.reduce((sum, item) => sum + item.pace_min_per_km, 0) / data.length;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const minutes = Math.floor(item.pace_min_per_km);
      const seconds = Math.round((item.pace_min_per_km - minutes) * 60);
      
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{`FC: ${item.heart_rate} bpm`}</p>
          <p className="text-sm font-medium">{`Ritmo: ${minutes}:${seconds.toString().padStart(2, '0')}/km`}</p>
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
          <span>Frequência Cardíaca vs Ritmo</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="heart_rate" 
                type="number"
                domain={['dataMin - 5', 'dataMax + 5']}
                tickFormatter={(value) => `${value} bpm`}
              />
              <YAxis 
                dataKey="pace_min_per_km"
                type="number"
                domain={['dataMin - 0.2', 'dataMax + 0.2']}
                tickFormatter={(value) => {
                  const minutes = Math.floor(value);
                  const seconds = Math.round((value - minutes) * 60);
                  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Reference lines for averages */}
              <ReferenceLine 
                x={avgHeartRate} 
                stroke="hsl(var(--primary))" 
                strokeDasharray="5 5" 
                strokeOpacity={0.7}
                label={{ value: "FC Média", position: "top" }}
              />
              <ReferenceLine 
                y={avgPace} 
                stroke="hsl(var(--secondary))" 
                strokeDasharray="5 5" 
                strokeOpacity={0.7}
                label={{ value: "Ritmo Médio", position: "top" }}
              />
              
              <Line 
                type="monotone" 
                dataKey="pace_min_per_km" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ r: 2, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Heart className="h-4 w-4 text-primary" />
            <span>FC Média: {Math.round(avgHeartRate)} bpm</span>
          </div>
          <div className="flex items-center space-x-2">
            <Timer className="h-4 w-4 text-secondary" />
            <span>Ritmo Médio: {Math.floor(avgPace)}:{Math.round((avgPace - Math.floor(avgPace)) * 60).toString().padStart(2, '0')}/km</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};