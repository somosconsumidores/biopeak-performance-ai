import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Heart } from 'lucide-react';

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
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Zonas de Frequência Cardíaca
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

  const zoneColors = {
    zone1: '#22c55e', // Green - Recovery
    zone2: '#84cc16', // Light green - Aerobic
    zone3: '#eab308', // Yellow - Aerobic
    zone4: '#f97316', // Orange - Threshold
    zone5: '#ef4444'  // Red - VO2 Max
  };

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          Distribuição das Zonas de FC
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
              <XAxis 
                dataKey="week" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: any, name: string) => [
                  `${value.toFixed(1)}%`,
                  name.replace('zone', 'Zona ')
                ]}
                labelFormatter={(label) => `Semana: ${label}`}
              />
              <Bar dataKey="zone1" stackId="zones" fill={zoneColors.zone1} name="zone1" />
              <Bar dataKey="zone2" stackId="zones" fill={zoneColors.zone2} name="zone2" />
              <Bar dataKey="zone3" stackId="zones" fill={zoneColors.zone3} name="zone3" />
              <Bar dataKey="zone4" stackId="zones" fill={zoneColors.zone4} name="zone4" />
              <Bar dataKey="zone5" stackId="zones" fill={zoneColors.zone5} name="zone5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2 text-xs">
          {Object.entries(zoneColors).map(([zone, color], index) => (
            <div key={zone} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground">Z{index + 1}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-muted-foreground text-center">
          Z1: Recuperação | Z2: Aeróbico | Z3: Aeróbico | Z4: Limiar | Z5: VO₂ Max
        </div>
      </CardContent>
    </Card>
  );
};