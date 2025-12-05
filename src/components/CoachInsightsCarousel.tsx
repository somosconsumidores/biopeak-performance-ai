import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import { useCoachInsights, InsightData } from '@/hooks/useCoachInsights';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Zap,
  Heart,
  Target,
  Award,
  Brain,
  Sparkles,
  LucideIcon,
} from 'lucide-react';

// Map icon strings to Lucide components
const iconMap: Record<string, LucideIcon> = {
  'trending-up': TrendingUp,
  'trending_up': TrendingUp,
  'trendingup': TrendingUp,
  'trending-down': TrendingDown,
  'trending_down': TrendingDown,
  'trendingdown': TrendingDown,
  'alert-triangle': AlertTriangle,
  'alert_triangle': AlertTriangle,
  'alerttriangle': AlertTriangle,
  'activity': Activity,
  'zap': Zap,
  'heart': Heart,
  'target': Target,
  'award': Award,
  'brain': Brain,
  'sparkles': Sparkles,
};

// Status color configurations
const statusStyles: Record<InsightData['status'], { border: string; icon: string; bg: string }> = {
  positive: {
    border: 'border-l-emerald-500',
    icon: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  warning: {
    border: 'border-l-amber-500',
    icon: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  neutral: {
    border: 'border-l-slate-400',
    icon: 'text-slate-400',
    bg: 'bg-slate-400/10',
  },
};

const getIconComponent = (iconName: string): LucideIcon => {
  const normalizedName = iconName.toLowerCase().replace(/[-_\s]/g, '');
  return iconMap[normalizedName] || iconMap[iconName.toLowerCase()] || Activity;
};

export const CoachInsightsCarousel = () => {
  const { insights, loading, error } = useCoachInsights();

  const carouselItems = useMemo(() => {
    if (loading) {
      return Array.from({ length: 3 }).map((_, i) => (
        <CarouselItem key={`skeleton-${i}`} className="basis-[85%] sm:basis-[300px] pl-4">
          <Card className="glass-card border-glass-border border-l-4 border-l-muted h-full">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-12 w-full" />
              <div className="pt-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-24 mt-1" />
              </div>
            </CardContent>
          </Card>
        </CarouselItem>
      ));
    }

    if (error || insights.length === 0) {
      return [
        <CarouselItem key="empty" className="basis-[85%] sm:basis-[300px] pl-4">
          <Card className="glass-card border-glass-border border-l-4 border-l-slate-400 h-full">
            <CardContent className="p-4 flex flex-col items-center justify-center min-h-[140px] text-center">
              <Brain className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Coletando dados de eficiência...
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Continue treinando para gerar insights
              </p>
            </CardContent>
          </Card>
        </CarouselItem>,
      ];
    }

    return insights.map((insight) => {
      const { insight_data } = insight;
      const styles = statusStyles[insight_data.status] || statusStyles.neutral;
      const IconComponent = getIconComponent(insight_data.icon);

      return (
        <CarouselItem key={insight.id} className="basis-[85%] sm:basis-[300px] pl-4">
          <Card className={`glass-card border-glass-border border-l-4 ${styles.border} h-full hover:shadow-lg transition-shadow duration-300`}>
            <CardContent className="p-4 flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-md ${styles.bg}`}>
                  <IconComponent className={`h-4 w-4 ${styles.icon}`} />
                </div>
                <h4 className="font-semibold text-sm text-foreground line-clamp-1">
                  {insight_data.title}
                </h4>
              </div>

              {/* Body */}
              <p className="text-sm text-muted-foreground line-clamp-3 flex-1 mb-3">
                {insight_data.body}
              </p>

              {/* Footer KPI */}
              {insight_data.kpi_value && (
                <div className="pt-2 border-t border-border/50">
                  <span className={`text-2xl font-bold ${styles.icon}`}>
                    {insight_data.kpi_value}
                  </span>
                  {insight_data.kpi_label && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {insight_data.kpi_label}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </CarouselItem>
      );
    });
  }, [insights, loading, error]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-muted-foreground">
          Insights do Coach IA
        </h3>
      </div>
      
      <Carousel
        opts={{
          align: 'start',
          loop: false,
        }}
        className="w-full -ml-4"
      >
        <CarouselContent className="ml-0">
          {carouselItems}
        </CarouselContent>
      </Carousel>
    </div>
  );
};
