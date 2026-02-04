import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, AlertTriangle } from 'lucide-react';

interface EffortDistribution {
  startEffort: number;
  middleEffort: number;
  endEffort: number;
  startPace: number | null;
  middlePace: number | null;
  endPace: number | null;
  pattern: 'negative_split' | 'positive_split' | 'even_pace' | 'cardiac_drift' | 'economy';
  hasCardiacDrift: boolean;
  paceChange: 'faster' | 'slower' | 'stable';
  hrChange: 'higher' | 'lower' | 'stable';
}

interface EffortDistributionChartProps {
  data?: EffortDistribution | null;
}

const formatPace = (pace: number | null): string => {
  if (pace === null || pace <= 0) return '--:--';
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

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
          label: '🏃 Negative Split',
          color: 'bg-green-500',
          description: 'Acelerou e manteve eficiência cardíaca'
        };
      case 'positive_split':
        return {
          label: '🔻 Positive Split',
          color: 'bg-red-500',
          description: 'Desacelerou no final do treino'
        };
      case 'even_pace':
        return {
          label: '⚖️ Even Pace',
          color: 'bg-blue-500',
          description: 'Ritmo e esforço constantes'
        };
      case 'cardiac_drift':
        return {
          label: '😰 Cardiac Drift',
          color: 'bg-orange-500',
          description: 'FC subiu mas pace caiu (sinal de fadiga)'
        };
      case 'economy':
        return {
          label: '💪 Economia',
          color: 'bg-purple-500',
          description: 'Acelerou com menos esforço cardíaco'
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
  const hasPaceData = data.startPace !== null && data.middlePace !== null && data.endPace !== null;

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
          
          {data.hasCardiacDrift && (
            <div className="mt-3 p-3 bg-orange-950 border border-orange-700 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-orange-100">
                <strong className="text-orange-300">Cardiac Drift detectado:</strong> Sua FC aumentou enquanto o pace diminuiu. 
                Isso pode indicar desidratação, calor excessivo ou fadiga acumulada.
              </div>
            </div>
          )}
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
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Esforço (FC)']}
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
            <div className="text-muted-foreground text-xs">FC Início</div>
            {hasPaceData && (
              <div className="text-primary text-xs mt-1">
                {formatPace(data.startPace)}/km
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg">{data.middleEffort.toFixed(1)}%</div>
            <div className="text-muted-foreground text-xs">FC Meio</div>
            {hasPaceData && (
              <div className="text-primary text-xs mt-1">
                {formatPace(data.middlePace)}/km
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg">{data.endEffort.toFixed(1)}%</div>
            <div className="text-muted-foreground text-xs">FC Fim</div>
            {hasPaceData && (
              <div className={`text-xs mt-1 ${
                data.paceChange === 'faster' ? 'text-green-400' : 
                data.paceChange === 'slower' ? 'text-red-400' : 'text-primary'
              }`}>
                {formatPace(data.endPace)}/km
                {data.paceChange === 'faster' && ' ⬆'}
                {data.paceChange === 'slower' && ' ⬇'}
              </div>
            )}
          </div>
        </div>

        {/* Legend for HR and Pace changes */}
        <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>FC:</span>
            <span className={
              data.hrChange === 'higher' ? 'text-red-400' :
              data.hrChange === 'lower' ? 'text-green-400' : 'text-muted-foreground'
            }>
              {data.hrChange === 'higher' && '↑ Subiu'}
              {data.hrChange === 'lower' && '↓ Desceu'}
              {data.hrChange === 'stable' && '→ Estável'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span>Pace:</span>
            <span className={
              data.paceChange === 'faster' ? 'text-green-400' :
              data.paceChange === 'slower' ? 'text-red-400' : 'text-muted-foreground'
            }>
              {data.paceChange === 'faster' && '↑ Mais rápido'}
              {data.paceChange === 'slower' && '↓ Mais lento'}
              {data.paceChange === 'stable' && '→ Estável'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
