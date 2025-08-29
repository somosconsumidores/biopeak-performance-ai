import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

interface EffortDistribution {
  startEffort: number;
  middleEffort: number;
  endEffort: number;
  pattern: 'negative_split' | 'positive_split' | 'even_pace';
}

interface EffortDistributionChartProps {
  data?: EffortDistribution | null;
}

export const EffortDistributionChart = ({ data }: EffortDistributionChartProps) => {
  if (!data) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Distribuição de Esforço
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Dados insuficientes para análise
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { phase: 'Início', effort: data.startEffort, position: 1 },
    { phase: 'Meio', effort: data.middleEffort, position: 2 },
    { phase: 'Fim', effort: data.endEffort, position: 3 }
  ];

  const getPatternInfo = (pattern: string) => {
    switch (pattern) {
      case 'negative_split':
        return {
          label: 'Negative Split',
          color: 'bg-green-500',
          description: 'Acelera no final (ideal)'
        };
      case 'positive_split':
        return {
          label: 'Positive Split',
          color: 'bg-red-500',
          description: 'Desacelera no final'
        };
      case 'even_pace':
        return {
          label: 'Even Pace',
          color: 'bg-blue-500',
          description: 'Ritmo constante'
        };
      default:
        return {
          label: 'Não identificado',
          color: 'bg-gray-500',
          description: 'Padrão indefinido'
        };
    }
  };

  const patternInfo = getPatternInfo(data.pattern);

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Distribuição de Esforço
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Padrão de Esforço</span>
            <Badge className={`${patternInfo.color} text-white border-0`}>
              {patternInfo.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {patternInfo.description}
          </p>
        </div>

        <div className="h-48 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
              <XAxis 
                dataKey="phase" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                domain={[60, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: any) => [`${value.toFixed(1)}%`, 'Esforço']}
                labelFormatter={(label) => `Fase: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="effort" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold text-lg">{data.startEffort.toFixed(1)}%</div>
            <div className="text-muted-foreground text-xs">Início</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg">{data.middleEffort.toFixed(1)}%</div>
            <div className="text-muted-foreground text-xs">Meio</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg">{data.endEffort.toFixed(1)}%</div>
            <div className="text-muted-foreground text-xs">Fim</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};