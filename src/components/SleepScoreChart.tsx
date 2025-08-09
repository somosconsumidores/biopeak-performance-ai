import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Moon, Loader2 } from 'lucide-react';
import { useSleepScoreHistory } from '@/hooks/useSleepScoreHistory';

interface SleepScoreChartProps {
  className?: string;
}

export const SleepScoreChart = ({ className }: SleepScoreChartProps) => {
  const { sleepScores, loading, error } = useSleepScoreHistory();

  const chartData = useMemo(() => {
    if (!sleepScores || sleepScores.length === 0) return [];

    return sleepScores.map(item => ({
      date: new Date(item.date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
      }),
      score: item.score,
      source: item.source,
      fullDate: item.date
    }));
  }, [sleepScores]);

  const averageScore = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.round(chartData.reduce((sum, item) => sum + item.score, 0) / chartData.length);
  }, [chartData]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return 0;
    const firstScore = chartData[0].score;
    const lastScore = chartData[chartData.length - 1].score;
    return lastScore - firstScore;
  }, [chartData]);

  if (loading) {
    return (
      <Card className={`glass-card border-glass-border ${className}`}>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <span className="ml-2 text-muted-foreground">Carregando dados de sono...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || chartData.length === 0) {
    return null;
  }

  return (
    <Card className={`glass-card border-glass-border ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Moon className="h-6 w-6 text-primary" />
          <div>
            <h3 className="text-xl font-semibold">Evolução do Score de Sono</h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span>{chartData.length} registros</span>
              <span>Média: {averageScore} pontos</span>
              <div className="flex items-center gap-1">
                <TrendingUp className={`h-4 w-4 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                <span className={trend >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {trend > 0 ? '+' : ''}{trend} pontos
                </span>
              </div>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                        <p className="font-medium text-foreground">{label}</p>
                        <p className="text-primary">
                          Score: {payload[0].value} pontos
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          Fonte: {data.source}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};