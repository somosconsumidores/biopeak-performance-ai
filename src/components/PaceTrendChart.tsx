import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, Star } from 'lucide-react';

interface PaceTrendData {
  date: string;
  pace: number;
  isBest: boolean;
}

interface PaceTrendChartProps {
  data?: PaceTrendData[];
}

export const PaceTrendChart = ({ data = [] }: PaceTrendChartProps) => {
  const formatPace = (pace: number) => {
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!data.length) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Tendência de Pace
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
          <Clock className="h-5 w-5 text-primary" />
          Tendência de Pace Médio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={formatPace}
                domain={['dataMin - 0.2', 'dataMax + 0.2']}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: any) => [formatPace(value), 'Pace']}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="pace" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.isBest) {
                    return (
                      <g>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill="hsl(var(--accent))"
                          stroke="white"
                          strokeWidth={2}
                        />
                        <Star
                          x={cx - 4}
                          y={cy - 4}
                          width={8}
                          height={8}
                          fill="white"
                        />
                      </g>
                    );
                  }
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="hsl(var(--primary))"
                      stroke="white"
                      strokeWidth={2}
                    />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span>Pace médio</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-3 w-3 text-accent" />
            <span>Melhor pace</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};