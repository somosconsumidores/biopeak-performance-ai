import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Flame } from 'lucide-react';
import type { WeeklyCalories } from '@/hooks/useEvolutionStats';

interface WeeklyCaloriesChartProps {
  data: WeeklyCalories[];
}

export function WeeklyCaloriesChart({ data }: WeeklyCaloriesChartProps) {
  const chartData = data.filter(d => d.totalCalories > 0);
  
  if (chartData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-5 w-5 text-orange-500" />
          <h3 className="font-semibold">Calorias por Semana</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          Sem dados de calorias disponíveis
        </div>
      </div>
    );
  }

  // Calculate total and average
  const totalCalories = chartData.reduce((sum, d) => sum + d.totalCalories, 0);
  const avgCalories = Math.round(totalCalories / chartData.length);

  const formatCalories = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toString();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <h3 className="font-semibold">Calorias por Semana</h3>
        </div>
        <div className="text-sm font-medium text-orange-500">
          Média: {formatCalories(avgCalories)} kcal
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
            tickFormatter={formatCalories}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number) => [`${value.toLocaleString()} kcal`, 'Calorias']}
          />
          <Bar dataKey="totalCalories" radius={[4, 4, 0, 0]}>
            {chartData.map((_, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={index === chartData.length - 1 ? 'hsl(var(--primary))' : 'hsl(24, 94%, 50%)'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Últimas 8 semanas • Total: {totalCalories.toLocaleString()} kcal
      </p>
    </div>
  );
}
