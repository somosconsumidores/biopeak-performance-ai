import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { PieChartIcon } from 'lucide-react';
import type { ActivityDistribution } from '@/hooks/useEvolutionStats';

interface ActivityDistributionChartProps {
  data: ActivityDistribution[];
}

const COLORS = [
  'hsl(0, 84%, 60%)',      // Corrida - red
  'hsl(217, 91%, 60%)',    // Ciclismo - blue
  'hsl(187, 85%, 53%)',    // Natação - cyan
  'hsl(142, 71%, 45%)',    // Caminhada - green
  'hsl(262, 83%, 58%)',    // Outras - purple
  'hsl(24, 94%, 50%)',     // Extra - orange
];

export function ActivityDistributionChart({ data }: ActivityDistributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChartIcon className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold">Distribuição de Atividades</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          Sem dados de atividades disponíveis
        </div>
      </div>
    );
  }

  const totalActivities = data.reduce((sum, d) => sum + d.count, 0);

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // Don't show labels for very small slices
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor="middle" 
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold">Distribuição de Atividades</h3>
        </div>
        <div className="text-sm text-muted-foreground">
          {totalActivities} treinos
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={CustomLabel}
            outerRadius={80}
            innerRadius={40}
            dataKey="count"
            nameKey="type"
            paddingAngle={2}
          >
            {data.map((_, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]}
                strokeWidth={0}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string) => [
              `${value} treinos (${((value / totalActivities) * 100).toFixed(1)}%)`,
              name
            ]}
          />
          <Legend 
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '12px', paddingLeft: '10px' }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Últimas 8 semanas • Por tipo de atividade
      </p>
    </div>
  );
}
