import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { KmData } from '@/hooks/useRacePlanning';

interface PaceChartProps {
  data: KmData[];
  formatPace: (seconds: number) => string;
  avgPaceSeconds: number;
}

export function PaceChart({ data, formatPace, avgPaceSeconds }: PaceChartProps) {
  const chartData = data.map((row) => ({
    km: `${row.km}km`,
    pace: row.pace,
    paceDisplay: formatPace(row.pace),
  }));

  const avgPaceDisplay = formatPace(avgPaceSeconds);

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="km" 
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            domain={['dataMin - 10', 'dataMax + 10']}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value) => formatPace(value)}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-popover border rounded-lg p-3 shadow-lg">
                    <p className="font-medium">{payload[0].payload.km}</p>
                    <p className="text-sm text-muted-foreground">
                      Pace: <span className="font-mono text-primary">{payload[0].payload.paceDisplay}/km</span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <ReferenceLine 
            y={avgPaceSeconds} 
            stroke="hsl(var(--primary))" 
            strokeDasharray="5 5"
            label={{ 
              value: `Média: ${avgPaceDisplay}/km`, 
              position: 'insideTopRight',
              fill: 'hsl(var(--primary))'
            }}
          />
          <Line
            type="monotone"
            dataKey="pace"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
