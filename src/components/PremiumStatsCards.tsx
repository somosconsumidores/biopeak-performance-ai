import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, Heart, Zap, TrendingUp, TrendingDown } from 'lucide-react';

interface PremiumStatsCardsProps {
  weeklyDistance?: number;
  averagePace?: number;
  averageHeartRate?: number;
  cardiacEfficiency?: number;
}

export const PremiumStatsCards = ({
  weeklyDistance = 0,
  averagePace = 0,
  averageHeartRate = 0,
  cardiacEfficiency = 0
}: PremiumStatsCardsProps) => {
  const formatPace = (pace: number) => {
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const cards = [
    {
      title: '🏃 Distância Semanal Média',
      value: `${weeklyDistance.toFixed(1)} km`,
      trend: weeklyDistance > 30 ? 'up' : 'stable',
      color: 'from-blue-500 to-cyan-500',
      icon: Activity
    },
    {
      title: '⏱️ Pace Médio',
      value: averagePace > 0 ? `${formatPace(averagePace)} /km` : 'N/A',
      trend: averagePace < 6 ? 'up' : 'stable',
      color: 'from-green-500 to-emerald-500',
      icon: Clock
    },
    {
      title: '❤️ Frequência Cardíaca Média',
      value: averageHeartRate > 0 ? `${averageHeartRate} bpm` : 'N/A',
      trend: 'stable',
      color: 'from-red-500 to-pink-500',
      icon: Heart
    },
    {
      title: '⚡ Eficiência Cardíaca',
      value: cardiacEfficiency > 0 ? `${cardiacEfficiency.toFixed(0)} m/batimento` : 'N/A',
      trend: cardiacEfficiency > 100 ? 'up' : 'stable',
      color: 'from-purple-500 to-indigo-500',
      icon: Zap
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const IconComponent = card.icon;
        const TrendIcon = card.trend === 'up' ? TrendingUp : TrendingDown;
        
        return (
          <Card key={index} className="glass-card border-glass-border overflow-hidden">
            <CardContent className="p-0">
              <div className={`h-2 bg-gradient-to-r ${card.color}`} />
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <IconComponent className="h-5 w-5 text-muted-foreground" />
                  {card.trend !== 'stable' && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        card.trend === 'up' 
                          ? 'text-green-400 border-green-400/50' 
                          : 'text-red-400 border-red-400/50'
                      }`}
                    >
                      <TrendIcon className="h-3 w-3 mr-1" />
                      {card.trend === 'up' ? '↑' : '↓'}
                    </Badge>
                  )}
                </div>
                
                <div className="mb-1">
                  <div className="text-2xl font-bold">{card.value}</div>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  {card.title}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};