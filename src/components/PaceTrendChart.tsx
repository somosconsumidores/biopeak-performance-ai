import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Dados insuficientes para gerar o gráfico
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
        <XAxis 
          dataKey="date" 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickFormatter={formatPace}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip 
          formatter={(value, name) => [formatPace(Number(value)), 'Pace']}
          labelFormatter={(label) => `Data: ${label}`}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px'
          }}
        />
        <Line 
          type="monotone" 
          dataKey="pace" 
          stroke="hsl(var(--primary))" 
          strokeWidth={3}
          dot={(props) => {
            const { cx, cy, payload } = props;
            return (
              <circle 
                cx={cx} 
                cy={cy} 
                r={payload.isBest ? 6 : 4} 
                fill={payload.isBest ? "hsl(var(--accent))" : "hsl(var(--primary))"} 
                stroke={payload.isBest ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                strokeWidth={2}
              />
            );
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};