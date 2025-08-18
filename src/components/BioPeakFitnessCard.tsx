import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, TrendingDown, Calculator, BarChart3 } from 'lucide-react';
import { useFitnessScore } from '@/hooks/useFitnessScore';

export const BioPeakFitnessCard = () => {
  const { 
    currentScore, 
    scoreHistory, 
    loading, 
    error, 
    calculateFitnessScore, 
    getScoreTrend, 
    getScoreLabel 
  } = useFitnessScore();

  const handleCalculateScore = async () => {
    await calculateFitnessScore();
  };

  if (loading) {
    return (
      <Card className="glass-card border-glass-border col-span-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-card border-glass-border col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>BioPeak Fitness Score</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={handleCalculateScore} variant="outline">
              <Calculator className="h-4 w-4 mr-2" />
              Calcular Score
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentScore) {
    return (
      <Card className="glass-card border-glass-border col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>BioPeak Fitness Score</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Calcule seu score proprietário de fitness baseado no histórico de atividades
            </p>
            <Button onClick={handleCalculateScore} className="w-full">
              <Calculator className="h-4 w-4 mr-2" />
              Calcular Meu Score BioPeak
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const scoreTrend = getScoreTrend();
  const scoreLabel = getScoreLabel(currentScore.fitness_score);

  return (
    <Card className="glass-card border-glass-border col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>BioPeak Fitness Score</span>
          </div>
          <Button onClick={handleCalculateScore} variant="outline" size="sm">
            <Calculator className="h-4 w-4 mr-2" />
            Recalcular
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Score Principal */}
          <div className="text-center space-y-4">
            <div className="relative w-32 h-32 mx-auto">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="hsl(var(--muted))"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="hsl(var(--primary))"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 56 * (currentScore.fitness_score / 100)} ${2 * Math.PI * 56}`}
                  className="transition-all duration-500"
                  style={{
                    filter: `drop-shadow(0 0 4px hsl(var(--primary) / 0.3))`
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold">{currentScore.fitness_score.toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground">Score</div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Badge 
                variant="secondary"
                className={`text-sm ${scoreLabel.color}`}
              >
                {scoreLabel.label}
              </Badge>
              
              <div className="flex items-center justify-center space-x-2">
                {scoreTrend.trend === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : scoreTrend.trend === 'down' ? (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                ) : (
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                )}
                <span className={`text-sm font-medium ${
                  scoreTrend.trend === 'up' ? 'text-green-400' : 
                  scoreTrend.trend === 'down' ? 'text-red-400' : 'text-blue-400'
                }`}>
                  {scoreTrend.change > 0 ? '+' : ''}{scoreTrend.change} pontos
                </span>
              </div>
            </div>
          </div>

          {/* Componentes do Score */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Componentes do Score
            </h4>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Capacidade (ATL/CTL)</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                      style={{ width: `${(currentScore.capacity_score / 60) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium min-w-[2rem]">
                    {currentScore.capacity_score.toFixed(0)}/60
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Consistência</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                      style={{ width: `${(currentScore.consistency_score / 20) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium min-w-[2rem]">
                    {currentScore.consistency_score.toFixed(0)}/20
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Balanço de Recuperação</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500"
                      style={{ width: `${(currentScore.recovery_balance_score / 20) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium min-w-[2rem]">
                    {currentScore.recovery_balance_score.toFixed(0)}/20
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-muted">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>ATL (7d): {currentScore.atl_7day.toFixed(1)}</span>
                <span>CTL (42d): {currentScore.ctl_42day.toFixed(1)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Strain Diário: {currentScore.daily_strain.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        {/* Histórico Recente */}
        {scoreHistory.length > 0 && (
          <div className="mt-6 pt-6 border-t border-muted">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
              Evolução (30 dias)
            </h4>
            <div className="relative h-16 w-full">
              <svg className="w-full h-full" viewBox="0 0 400 60">
                {scoreHistory.map((point, index) => {
                  const x = (index / (scoreHistory.length - 1)) * 380 + 10;
                  const y = 50 - (point.score / 100) * 40;
                  const nextPoint = scoreHistory[index + 1];
                  
                  return (
                    <g key={index}>
                      {nextPoint && (
                        <line
                          x1={x}
                          y1={y}
                          x2={(index + 1) / (scoreHistory.length - 1) * 380 + 10}
                          y2={50 - (nextPoint.score / 100) * 40}
                          stroke="hsl(var(--primary))"
                          strokeWidth="2"
                        />
                      )}
                      <circle
                        cx={x}
                        cy={y}
                        r="2"
                        fill="hsl(var(--primary))"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};