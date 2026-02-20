import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, CartesianGrid } from 'recharts';
import type { EfficiencySegment } from '@/hooks/useEfficiencyFingerprint';

interface Props {
  segments: EfficiencySegment[];
}

export const EfficiencySyncChart = ({ segments }: Props) => {
  const hasPower = segments.some(s => s.avg_power !== null);
  
  const chartData = segments.map(s => ({
    km: (s.end_distance_m / 1000).toFixed(1),
    hr: s.avg_hr,
    pace: s.avg_pace_min_km,
    power: s.avg_power,
    score: s.efficiency_score,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    return (
      <div className="rounded-lg border border-border/50 bg-background/95 backdrop-blur-sm p-3 text-xs shadow-lg space-y-1">
        <p className="font-semibold">km {label}</p>
        <p className="text-red-400">FC: {d.hr} bpm</p>
        <p className="text-blue-400">Pace: {d.pace?.toFixed(2)} min/km</p>
        {d.power && <p className="text-yellow-400">Potência: {d.power} W</p>}
        <p className="text-primary">Eficiência: {d.score}/100</p>
      </div>
    );
  };

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">FC × {hasPower ? 'Potência × ' : ''}Pace sincronizado</h4>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis dataKey="km" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={['auto', 'auto']} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={['auto', 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="score"
            fill="hsl(var(--primary) / 0.1)"
            stroke="none"
          />
          <Line yAxisId="left" type="monotone" dataKey="hr" stroke="#ef4444" strokeWidth={2} dot={false} name="FC" />
          {hasPower && (
            <Line yAxisId="left" type="monotone" dataKey="power" stroke="#eab308" strokeWidth={2} dot={false} name="Potência" />
          )}
          <Line yAxisId="right" type="monotone" dataKey="pace" stroke="#3b82f6" strokeWidth={2} dot={false} name="Pace" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
