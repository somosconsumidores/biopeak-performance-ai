import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import { BarChart3 } from 'lucide-react';

interface VolumeData {
  week: string;
  distance: number;
  workouts: number;
}

interface VolumeEvolutionChartProps {
  data?: VolumeData[];
}

export const VolumeEvolutionChart = ({ data = [] }: VolumeEvolutionChartProps) => {
  if (!data.length) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Volume Semanal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Dados insuficientes para gerar o gráfico
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Volume Semanal (km + nº treinos)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
              <XAxis 
                dataKey="week" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                yAxisId="distance"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                yAxisId="workouts"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: any, name: string) => [
                  name === 'distance' ? `${value.toFixed(1)} km` : `${value} treinos`,
                  name === 'distance' ? 'Distância' : 'Treinos'
                ]}
              />
              <Bar 
                yAxisId="distance"
                dataKey="distance" 
                fill="hsl(var(--primary))" 
                opacity={0.7}
                name="distance"
              />
              <Line 
                yAxisId="workouts"
                type="monotone" 
                dataKey="workouts" 
                stroke="hsl(var(--accent))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--accent))', strokeWidth: 2, r: 4 }}
                name="workouts"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Barras: distância em km | Linha: número de treinos
        </div>
      </CardContent>
    </Card>
  );
};