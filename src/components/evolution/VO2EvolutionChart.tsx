import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity } from 'lucide-react';
import type { WeeklyVO2 } from '@/hooks/useEvolutionStats';

interface VO2EvolutionChartProps {
  data: WeeklyVO2[];
}

export function VO2EvolutionChart({ data }: VO2EvolutionChartProps) {
  const chartData = data.filter(d => d.vo2Max !== null);
  
  if (chartData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-emerald-500" />
          <h3 className="font-semibold">Evolução do VO2max</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          Sem dados de VO2max disponíveis
        </div>
      </div>
    );
  }

  // Calculate trend
  const firstValue = chartData[0]?.vo2Max || 0;
  const lastValue = chartData[chartData.length - 1]?.vo2Max || 0;
  const trend = lastValue - firstValue;
  const trendPercent = firstValue > 0 ? ((trend / firstValue) * 100).toFixed(1) : '0';

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-500" />
          <h3 className="font-semibold">Evolução do VO2max</h3>
        </div>
        <div className={`text-sm font-medium ${trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {trend >= 0 ? '+' : ''}{trendPercent}%
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
            domain={['dataMin - 2', 'dataMax + 2']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number) => [`${value.toFixed(1)} ml/kg/min`, 'VO2max']}
          />
          <Bar dataKey="vo2Max" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={index === chartData.length - 1 ? 'hsl(var(--primary))' : 'hsl(160, 84%, 39%)'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Últimas 8 semanas • Média semanal
      </p>
    </div>
  );
}
