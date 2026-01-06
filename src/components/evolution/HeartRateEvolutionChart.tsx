import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Heart } from 'lucide-react';
import type { WeeklyHeartRate } from '@/hooks/useEvolutionStats';

interface HeartRateEvolutionChartProps {
  data: WeeklyHeartRate[];
}

export function HeartRateEvolutionChart({ data }: HeartRateEvolutionChartProps) {
  const chartData = data.filter(d => d.avgHR !== null || d.maxHR !== null);
  
  if (chartData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="h-5 w-5 text-red-500" />
          <h3 className="font-semibold">Frequência Cardíaca</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          Sem dados de frequência cardíaca disponíveis
        </div>
      </div>
    );
  }

  // Calculate averages
  const avgHRValues = chartData.filter(d => d.avgHR).map(d => d.avgHR!);
  const maxHRValues = chartData.filter(d => d.maxHR).map(d => d.maxHR!);
  const overallAvgHR = avgHRValues.length > 0 
    ? Math.round(avgHRValues.reduce((a, b) => a + b, 0) / avgHRValues.length)
    : null;
  const overallMaxHR = maxHRValues.length > 0 
    ? Math.max(...maxHRValues)
    : null;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          <h3 className="font-semibold">Frequência Cardíaca</h3>
        </div>
        <div className="flex gap-4 text-sm">
          {overallAvgHR && (
            <span className="text-muted-foreground">
              Média: <span className="text-foreground font-medium">{overallAvgHR} bpm</span>
            </span>
          )}
          {overallMaxHR && (
            <span className="text-muted-foreground">
              Máx: <span className="text-red-500 font-medium">{overallMaxHR} bpm</span>
            </span>
          )}
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis 
            dataKey="week" 
            tick={{ fontSize: 11 }} 
            className="fill-muted-foreground"
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize: 11 }} 
            className="fill-muted-foreground"
            tickLine={false}
            domain={['dataMin - 10', 'dataMax + 10']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number, name: string) => [
              `${value} bpm`, 
              name === 'avgHR' ? 'FC Média' : 'FC Máxima'
            ]}
          />
          <Legend 
            formatter={(value) => value === 'avgHR' ? 'FC Média' : 'FC Máxima'}
            wrapperStyle={{ fontSize: '12px' }}
          />
          <Line 
            type="monotone" 
            dataKey="avgHR" 
            stroke="hsl(217, 91%, 60%)"
            strokeWidth={2}
            dot={{ fill: 'hsl(217, 91%, 60%)', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
          <Line 
            type="monotone" 
            dataKey="maxHR" 
            stroke="hsl(0, 84%, 60%)"
            strokeWidth={2}
            dot={{ fill: 'hsl(0, 84%, 60%)', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Últimas 8 semanas • Linhas suavizadas
      </p>
    </div>
  );
}
