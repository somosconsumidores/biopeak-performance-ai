import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertTriangle } from 'lucide-react';

interface VariationAnalysis {
  paceCV: number;
  hrCV: number;
  consistency: 'good' | 'moderate' | 'poor';
  weeklyData: Array<{
    week: string;
    paceCV: number;
    hrCV: number;
  }>;
}

interface VariationAnalysisChartProps {
  data?: VariationAnalysis | null;
}

export const VariationAnalysisChart = ({ data }: VariationAnalysisChartProps) => {
  if (!data || !data.weeklyData.length) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Coeficiente de Variação
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

  const getConsistencyColor = (consistency: string) => {
    switch (consistency) {
      case 'good': return 'bg-green-500';
      case 'moderate': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getConsistencyLabel = (consistency: string) => {
    switch (consistency) {
      case 'good': return 'Boa Consistência';
      case 'moderate': return 'Consistência Moderada';
      case 'poor': return 'Baixa Consistência';
      default: return 'Não avaliado';
    }
  };

  const showAlert = data.paceCV > 0.2 || data.hrCV > 0.2;

  // Transform data to percentages for chart display
  const chartData = data.weeklyData.map(week => ({
    ...week,
    paceCV: week.paceCV * 100,
    hrCV: week.hrCV * 100
  }));

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Coeficiente de Variação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Consistência</span>
            <Badge className={`${getConsistencyColor(data.consistency)} text-white border-0`}>
              {getConsistencyLabel(data.consistency)}
            </Badge>
          </div>
          
          {showAlert && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="text-sm text-amber-600 dark:text-amber-400">
                CV elevado indica treino inconsistente
              </span>
            </div>
          )}
        </div>

        <div className="h-48 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
              <XAxis 
                dataKey="week" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                domain={[0, 40]}
                tickFormatter={(value) => `${value.toFixed(1)}%`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: any, name: string) => [
                  `${value.toFixed(1)}%`,
                  name === 'paceCV' ? 'CV Pace' : 'CV FC'
                ]}
                labelFormatter={(label) => `Semana: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="paceCV" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
                name="paceCV"
              />
              <Line 
                type="monotone" 
                dataKey="hrCV" 
                stroke="hsl(var(--accent))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--accent))', strokeWidth: 2, r: 3 }}
                name="hrCV"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-muted-foreground">CV Pace</span>
            </div>
            <div className="font-semibold">{(data.paceCV * 100).toFixed(1)}%</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent" />
              <span className="text-muted-foreground">CV FC</span>
            </div>
            <div className="font-semibold">{(data.hrCV * 100).toFixed(1)}%</div>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-muted-foreground">
          Quanto menor o CV, mais consistente o treino
        </div>
      </CardContent>
    </Card>
  );
};