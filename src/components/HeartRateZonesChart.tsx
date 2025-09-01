import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ZonesData {
  week: string;
  zone1: number;
  zone2: number;
  zone3: number;
  zone4: number;
  zone5: number;
}

interface HeartRateZonesChartProps {
  data?: ZonesData[];
}

export const HeartRateZonesChart = ({ data = [] }: HeartRateZonesChartProps) => {
  if (!data.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Dados insuficientes para gerar o gráfico
      </div>
    );
  }

  const zoneColors = {
    zone1: '#22c55e', // Green - Recovery
    zone2: '#84cc16', // Light green - Aerobic
    zone3: '#eab308', // Yellow - Aerobic
    zone4: '#f97316', // Orange - Threshold
    zone5: '#ef4444'  // Red - VO2 Max
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
        <XAxis 
          dataKey="week" 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
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
        <Bar dataKey="zone1" stackId="zones" fill={zoneColors.zone1} name="Zona 1" radius={[0, 0, 0, 0]} />
        <Bar dataKey="zone2" stackId="zones" fill={zoneColors.zone2} name="Zona 2" radius={[0, 0, 0, 0]} />
        <Bar dataKey="zone3" stackId="zones" fill={zoneColors.zone3} name="Zona 3" radius={[0, 0, 0, 0]} />
        <Bar dataKey="zone4" stackId="zones" fill={zoneColors.zone4} name="Zona 4" radius={[0, 0, 0, 0]} />
        <Bar dataKey="zone5" stackId="zones" fill={zoneColors.zone5} name="Zona 5" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};