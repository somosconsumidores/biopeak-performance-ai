import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Gauge } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { WeeklyPace } from '@/hooks/useEvolutionStats';

interface PaceEvolutionChartProps {
  data: Record<string, WeeklyPace[]>;
}

const ACTIVITY_LABELS: Record<string, string> = {
  running: 'Corrida',
  cycling: 'Ciclismo',
  swimming: 'Natação',
  walking: 'Caminhada',
  other: 'Outras',
};

const ACTIVITY_COLORS: Record<string, string> = {
  running: 'hsl(0, 84%, 60%)',
  cycling: 'hsl(217, 91%, 60%)',
  swimming: 'hsl(187, 85%, 53%)',
  walking: 'hsl(142, 71%, 45%)',
  other: 'hsl(262, 83%, 58%)',
};

export function PaceEvolutionChart({ data }: PaceEvolutionChartProps) {
  // Find available activities (with at least some data)
  const availableActivities = Object.entries(data)
    .filter(([_, paces]) => paces.some(p => p.avgPace !== null))
    .map(([key]) => key);

  const [selectedActivity, setSelectedActivity] = useState<string>(
    availableActivities.includes('running') ? 'running' : availableActivities[0] || 'running'
  );

  const chartData = (data[selectedActivity] || []).filter(d => d.avgPace !== null);

  if (availableActivities.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="h-5 w-5 text-orange-500" />
          <h3 className="font-semibold">Evolução do Pace Médio</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          Sem dados de pace disponíveis
        </div>
      </div>
    );
  }

  // Calculate trend
  const filteredData = chartData.filter(d => d.avgPace !== null);
  const firstValue = filteredData[0]?.avgPace || 0;
  const lastValue = filteredData[filteredData.length - 1]?.avgPace || 0;
  const trend = lastValue - firstValue;
  // For pace, negative is better (faster)
  const isImproving = selectedActivity === 'running' || selectedActivity === 'swimming' 
    ? trend < 0 
    : trend > 0; // For cycling, higher pace (speed) is better

  const formatPace = (value: number) => {
    if (selectedActivity === 'cycling') {
      return `${value.toFixed(1)} km/h`;
    }
    const minutes = Math.floor(value);
    const seconds = Math.round((value - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-orange-500" />
          <h3 className="font-semibold">Evolução do Pace Médio</h3>
        </div>
        
        <Tabs value={selectedActivity} onValueChange={setSelectedActivity}>
          <TabsList className="h-8">
            {availableActivities.map((activity) => (
              <TabsTrigger 
                key={activity} 
                value={activity}
                className="text-xs px-2 h-7"
              >
                {ACTIVITY_LABELS[activity]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      
      {chartData.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
          Sem dados para {ACTIVITY_LABELS[selectedActivity]}
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                domain={['dataMin - 0.5', 'dataMax + 0.5']}
                reversed={selectedActivity !== 'cycling'}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [formatPace(value), 'Pace médio']}
              />
              <Bar dataKey="avgPace" radius={[4, 4, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === chartData.length - 1 ? 'hsl(var(--primary))' : ACTIVITY_COLORS[selectedActivity]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">
              Últimas 8 semanas • Média semanal
            </p>
            {filteredData.length >= 2 && (
              <p className={`text-xs font-medium ${isImproving ? 'text-emerald-500' : 'text-red-500'}`}>
                {isImproving ? '↑ Melhorando' : '↓ Piorando'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
