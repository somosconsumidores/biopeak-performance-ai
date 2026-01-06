import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';
import type { WeeklyFitnessScore } from '@/hooks/useEvolutionStats';

interface FitnessScoreEvolutionChartProps {
  data: WeeklyFitnessScore[];
}

export function FitnessScoreEvolutionChart({ data }: FitnessScoreEvolutionChartProps) {
  const chartData = data.filter(d => d.fitnessScore !== null);
  
  if (chartData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold">BioPeak Fitness Score</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          Sem dados de Fitness Score disponíveis
        </div>
      </div>
    );
  }

  const firstValue = chartData[0]?.fitnessScore || 0;
  const lastValue = chartData[chartData.length - 1]?.fitnessScore || 0;
  const trend = lastValue - firstValue;
  const trendPercent = firstValue > 0 ? ((trend / firstValue) * 100).toFixed(1) : '0';

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold">BioPeak Fitness Score</h3>
        </div>
        <div className={`text-sm font-medium ${trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {trend >= 0 ? '+' : ''}{trendPercent}%
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="fitnessGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis 
            dataKey="week" 
            tick={{ fontSize: 11 }} 
            className="fill-muted-foreground"
            tickLine={false}
          />
          <YAxis 
            domain={[0, 100]} 
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
            formatter={(value: number) => [`${value.toFixed(1)}`, 'Fitness Score']}
          />
          <Area 
            type="monotone" 
            dataKey="fitnessScore" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            fill="url(#fitnessGradient)" 
          />
        </AreaChart>
      </ResponsiveContainer>
      
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Últimas 8 semanas • Média semanal do BioPeak Fitness Score
      </p>
    </div>
  );
}
