import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Users, TrendingUp, TrendingDown, Zap, Rocket, Dumbbell } from 'lucide-react';
import { useAveragePaceComparison } from '@/hooks/useAveragePaceComparison';
import { formatSpeedOrPace, isCyclingActivity, isSwimmingActivity } from '@/utils/activityTypeUtils';

interface PaceComparisonCardProps {
  currentPace: number | null | undefined;
  activityType: string | null | undefined;
}

export function PaceComparisonCard({ currentPace, activityType }: PaceComparisonCardProps) {
  const { comparison, loading, error, hasData } = useAveragePaceComparison(currentPace, activityType);

  // Don't render if no valid data or unsupported activity type
  if (!loading && !hasData) {
    return null;
  }

  if (loading) {
    return (
      <Card className="glass-card border-glass-border mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Comparação com a Comunidade</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-16 w-full mt-4" />
        </CardContent>
      </Card>
    );
  }

  if (error || !comparison) {
    return null;
  }

  const { 
    currentPace: pace, 
    communityAverage, 
    percentDifference, 
    isFasterThanAverage, 
    category,
    totalActivities,
  } = comparison;

  // Determine badge style and message based on performance
  const isClose = percentDifference <= 2;
  
  let badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
  let badgeIcon = <Rocket className="h-4 w-4 mr-1" />;
  let badgeMessage = '';
  let motivationalMessage = '';

  if (isClose) {
    badgeVariant = 'secondary';
    badgeIcon = <Zap className="h-4 w-4 mr-1" />;
    badgeMessage = 'Na média da comunidade';
    motivationalMessage = 'Você está alinhado com os demais atletas. Continue firme!';
  } else if (isFasterThanAverage) {
    badgeVariant = 'default';
    badgeIcon = <Rocket className="h-4 w-4 mr-1" />;
    badgeMessage = `${percentDifference.toFixed(1)}% mais rápido que a média`;
    motivationalMessage = 'Parabéns! Você está acima da média da comunidade.';
  } else {
    badgeVariant = 'outline';
    badgeIcon = <Dumbbell className="h-4 w-4 mr-1" />;
    badgeMessage = `${percentDifference.toFixed(1)}% abaixo da média`;
    motivationalMessage = 'Continue treinando! Cada treino te aproxima do seu objetivo.';
  }

  // Format pace as mm:ss
  const formatPaceTime = (paceValue: number) => {
    const minutes = Math.floor(paceValue);
    const seconds = Math.round((paceValue - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format current pace display (currentPace is always in min/km from activity)
  const getCurrentPaceDisplay = () => {
    if (category === 'CYCLING') {
      // Convert min/km to km/h
      return `${(60 / pace).toFixed(1)} km/h`;
    } else if (category === 'SWIMMING') {
      // Convert from min/km to min/100m (divide by 10)
      const pacePer100m = pace / 10;
      return `${formatPaceTime(pacePer100m)}/100m`;
    } else {
      // Running - already in min/km
      return `${formatPaceTime(pace)}/km`;
    }
  };

  // Format community average display (already in correct unit from average_pace table)
  const getCommunityDisplay = () => {
    if (category === 'CYCLING') {
      // Already in km/h
      return `${communityAverage.toFixed(1)} km/h`;
    } else if (category === 'SWIMMING') {
      // Already in min/100m - no conversion needed
      return `${formatPaceTime(communityAverage)}/100m`;
    } else {
      // Running - already in min/km
      return `${formatPaceTime(communityAverage)}/km`;
    }
  };

  const currentPaceDisplay = getCurrentPaceDisplay();
  const communityDisplay = getCommunityDisplay();

  // Get category label in Portuguese
  const getCategoryLabel = () => {
    switch (category) {
      case 'RUNNING': return 'corridas';
      case 'CYCLING': return 'pedaladas';
      case 'SWIMMING': return 'natações';
    }
  };

  return (
    <Card className="glass-card border-glass-border mb-8">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Comparação com a Comunidade</span>
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {totalActivities.toLocaleString('pt-BR')} atletas
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pace Comparison Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* User's Pace */}
          <div className="bg-primary/10 rounded-lg p-4 text-center border border-primary/20">
            <div className="text-sm text-muted-foreground mb-2">Seu Pace</div>
            <div className="text-2xl sm:text-3xl font-bold text-primary">
              {currentPaceDisplay}
            </div>
            <div className="text-xs text-muted-foreground mt-1">este treino</div>
          </div>

          {/* Community Average */}
          <div className="bg-muted/50 rounded-lg p-4 text-center border border-border">
            <div className="text-sm text-muted-foreground mb-2">Média da Comunidade</div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground">
              {communityDisplay}
            </div>
            <div className="text-xs text-muted-foreground mt-1">últimos 30 dias</div>
          </div>
        </div>

        {/* Performance Badge */}
        <div className={`rounded-lg p-4 ${
          isFasterThanAverage && !isClose 
            ? 'bg-green-500/10 border border-green-500/30' 
            : isClose 
              ? 'bg-blue-500/10 border border-blue-500/30'
              : 'bg-orange-500/10 border border-orange-500/30'
        }`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Badge variant={badgeVariant} className="text-sm px-3 py-1">
              {badgeIcon}
              {badgeMessage}
            </Badge>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {motivationalMessage}
          </p>
        </div>

        {/* Footer Info */}
        <div className="text-center text-xs text-muted-foreground">
          Baseado em {totalActivities.toLocaleString('pt-BR')} {getCategoryLabel()} de todos os atletas BioPeak nos últimos 30 dias.
        </div>
      </CardContent>
    </Card>
  );
}
