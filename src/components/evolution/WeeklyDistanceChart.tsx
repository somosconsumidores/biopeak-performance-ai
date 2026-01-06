import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MapPin } from 'lucide-react';
import type { WeeklyDistance } from '@/hooks/useEvolutionStats';

interface WeeklyDistanceChartProps {
  data: WeeklyDistance[];
}

export function WeeklyDistanceChart({ data }: WeeklyDistanceChartProps) {
  const chartData = data.filter(d => d.totalKm > 0);
  
  if (chartData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold">Km por Semana</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          Sem dados de distância disponíveis
        </div>
      </div>
    );
  }

  // Calculate total
  const totalKm = chartData.reduce((sum, d) => sum + d.totalKm, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold">Km por Semana</h3>
        </div>
        <div className="text-sm font-medium text-blue-500">
          Total: {totalKm.toFixed(1)} km
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
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number) => [`${value.toFixed(1)} km`, 'Distância']}
          />
          <Bar dataKey="totalKm" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={index === chartData.length - 1 ? 'hsl(var(--primary))' : 'hsl(217, 91%, 60%)'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Últimas 8 semanas • Soma semanal
      </p>
    </div>
  );
}
