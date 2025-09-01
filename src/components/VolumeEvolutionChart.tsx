import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';

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
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Dados insuficientes para gerar o gráfico
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
        <XAxis 
          dataKey="week" 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          yAxisId="distance"
          orientation="left"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          yAxisId="workouts"
          orientation="right"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px'
          }}
        />
        <Bar 
          yAxisId="distance"
          dataKey="distance" 
          fill="hsl(var(--primary))" 
          opacity={0.8} 
          radius={[4, 4, 0, 0]}
          name="Distância (km)"
        />
        <Line 
          yAxisId="workouts"
          type="monotone" 
          dataKey="workouts" 
          stroke="hsl(var(--accent))" 
          strokeWidth={3}
          dot={{ fill: 'hsl(var(--accent))', strokeWidth: 2, r: 4 }}
          name="Nº de Treinos"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};