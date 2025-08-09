import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Moon } from 'lucide-react';
import { SleepFeedbackAnalysis } from '@/hooks/useSleepFeedback';

interface SleepScoreChartProps {
  feedbacks: SleepFeedbackAnalysis[];
}

export const SleepScoreChart = ({ feedbacks }: SleepScoreChartProps) => {
  const chartData = useMemo(() => {
    if (!feedbacks || feedbacks.length === 0) return [];

    return feedbacks
      .filter(feedback => feedback.sleep_data?.sleepScore)
      .map(feedback => ({
        date: new Date(feedback.created_at).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit'
        }),
        score: feedback.sleep_data.sleepScore,
        fullDate: feedback.created_at
      }))
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())
      .slice(-10); // Últimos 10 registros
  }, [feedbacks]);

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

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card className="glass-card border-glass-border mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Moon className="h-6 w-6 text-primary" />
          <div>
            <h3 className="text-xl font-semibold">Evolução do Score de Sono</h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
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
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                        <p className="font-medium text-foreground">{label}</p>
                        <p className="text-primary">
                          Score: {payload[0].value} pontos
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