import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import { useCoachInsights, InsightData } from '@/hooks/useCoachInsights';
import { useSubscription } from '@/hooks/useSubscription';
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
  Footprints,
  Bike,
  Crown,
  Lock,
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
  'footprints': Footprints,
  'bike': Bike,
  'run': Footprints,
  'running': Footprints,
  'cycling': Bike,
};

// Status configurations with badge text - using semantic design tokens
const statusConfig: Record<InsightData['status'], {
  border: string;
  icon: string;
  bg: string;
  glow: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
  meterColor: string;
  valueColor: string;
}> = {
  positive: {
    border: 'border-border',
    icon: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    glow: '',
    badge: 'ZONA SEGURA',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    meterColor: 'bg-emerald-500',
    valueColor: 'text-emerald-600 dark:text-emerald-500',
  },
  warning: {
    border: 'border-border',
    icon: 'text-amber-500',
    bg: 'bg-amber-500/10',
    glow: '',
    badge: 'ATENÇÃO',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-600 dark:text-amber-400',
    meterColor: 'bg-amber-500',
    valueColor: 'text-amber-600 dark:text-amber-500',
  },
  neutral: {
    border: 'border-border',
    icon: 'text-muted-foreground',
    bg: 'bg-muted/50',
    glow: '',
    badge: 'ESTÁVEL',
    badgeBg: 'bg-muted',
    badgeText: 'text-muted-foreground',
    meterColor: 'bg-muted-foreground',
    valueColor: 'text-foreground',
  },
};

// Educational microcopy based on insight type
const getMicrocopy = (insightType: string): string => {
  const microcopyMap: Record<string, string> = {
    'injury_risk_run': 'ACWR ideal entre 0.8 e 1.3',
    'running_efficiency_trend': 'Mede sua economia de corrida',
    'cycling_efficiency_trend': 'Relação potência x frequência cardíaca',
    'efficiency_trend': 'Tendência de eficiência aeróbica',
  };
  return microcopyMap[insightType] || 'Baseado nos seus últimos treinos';
};

// Get sport icon for watermark
const getSportIcon = (insightType: string): LucideIcon => {
  if (insightType.includes('cycling') || insightType.includes('bike')) return Bike;
  if (insightType.includes('running') || insightType.includes('run')) return Footprints;
  return Heart;
};

const getIconComponent = (iconName: string): LucideIcon => {
  const normalizedName = iconName.toLowerCase().replace(/[-_\s]/g, '');
  return iconMap[normalizedName] || iconMap[iconName.toLowerCase()] || Activity;
};

// Parse KPI value to get numeric value for meter
const parseKpiValue = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const match = String(value).match(/-?[\d.]+/);
  return match ? parseFloat(match[0]) : null;
};

// Context meter component for ACWR
const ACWRMeter = ({ value, color }: { value: number; color: string }) => {
  // ACWR ranges: <0.8 (low), 0.8-1.3 (ideal), >1.3 (high)
  const position = Math.min(Math.max((value / 2) * 100, 5), 95);
  
  return (
    <div className="mt-4 space-y-1.5">
      <div className="relative h-1.5 rounded-full overflow-hidden bg-gradient-to-r from-amber-400/40 via-emerald-500/60 to-red-400/40">
        {/* Marker */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-card shadow-sm z-10"
          style={{ 
            left: `${position}%`,
            backgroundColor: color,
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Baixo</span>
        <span className="text-emerald-500 font-medium">Ideal</span>
        <span>Alto</span>
      </div>
    </div>
  );
};

// Efficiency trend meter
const EfficiencyMeter = ({ value, color }: { value: number; color: string }) => {
  // Map -20% to +20% range to 0-100
  const position = Math.min(Math.max(((value + 20) / 40) * 100, 5), 95);
  
  return (
    <div className="mt-4 space-y-1.5">
      <div className="relative h-1.5 rounded-full overflow-hidden bg-gradient-to-r from-red-400/40 via-muted/60 to-emerald-400/40">
        {/* Marker */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-card shadow-sm z-10"
          style={{ 
            left: `${position}%`,
            backgroundColor: color,
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>-20%</span>
        <span>0%</span>
        <span>+20%</span>
      </div>
    </div>
  );
};

export const CoachInsightsCarousel = () => {
  const { isSubscribed, loading: subscriptionLoading } = useSubscription();
  const { insights, loading, error } = useCoachInsights(isSubscribed);
  const navigate = useNavigate();

  const carouselItems = useMemo(() => {
    // Show Pro-only card immediately for non-subscribers (don't wait for data loading)
    if (!subscriptionLoading && isSubscribed === false) {
      return [
        <CarouselItem key="pro-only" className="basis-[85%] sm:basis-[280px] pl-4">
          <Card className="bg-card border-primary/20 h-full overflow-hidden relative shadow-sm">
            {/* Lock watermark */}
            <div className="absolute -bottom-6 -right-6 opacity-[0.03] pointer-events-none">
              <Lock className="h-28 w-28" />
            </div>
            
            <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center min-h-[200px] text-center relative z-10">
              <div className="p-2.5 rounded-lg bg-primary/10 mb-3">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              
              <Badge 
                variant="outline" 
                className="bg-primary/10 text-primary border-0 text-[9px] font-bold px-2.5 py-0.5 mb-3 rounded-md"
              >
                CONTEÚDO PRO
              </Badge>
              
              <h4 className="font-semibold text-sm text-foreground mb-1.5">
                Insights do Coach IA
              </h4>
              
              <p className="text-xs text-muted-foreground mb-4 max-w-[180px] leading-relaxed">
                Análises personalizadas sobre seu desempenho, exclusivo para assinantes Pro.
              </p>
              
              <Button 
                size="sm" 
                onClick={() => navigate('/paywall2')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Desbloquear
              </Button>
            </CardContent>
          </Card>
        </CarouselItem>,
      ];
    }

    // Show skeleton while loading subscription status or data for subscribers
    if (loading || subscriptionLoading) {
      return Array.from({ length: 2 }).map((_, i) => (
        <CarouselItem key={`skeleton-${i}`} className="basis-[85%] sm:basis-[280px] pl-4">
          <Card className="bg-card border-border h-full overflow-hidden shadow-sm">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        </CarouselItem>
      ));
    }

    if (error || insights.length === 0) {
      return [
        <CarouselItem key="empty" className="basis-[85%] sm:basis-[280px] pl-4">
          <Card className="bg-card border-border h-full overflow-hidden relative shadow-sm">
            <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center min-h-[180px] text-center">
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03]">
                <Brain className="h-28 w-28" />
              </div>
              <div className="relative z-10">
                <div className="p-2.5 rounded-lg bg-primary/10 mb-3">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Analisando seus dados...
                </p>
                <p className="text-xs text-muted-foreground">
                  Continue treinando para gerar insights personalizados
                </p>
              </div>
            </CardContent>
          </Card>
        </CarouselItem>,
      ];
    }

    return insights.map((insight) => {
      const { insight_data, insight_type } = insight;
      const config = statusConfig[insight_data.status] || statusConfig.neutral;
      const IconComponent = getIconComponent(insight_data.icon);
      const WatermarkIcon = getSportIcon(insight_type);
      const microcopy = getMicrocopy(insight_type);
      
      const kpiNumeric = parseKpiValue(insight_data.kpi_value);
      const isACWR = insight_type === 'injury_risk_run';
      const isEfficiency = insight_type.includes('efficiency');

      return (
        <CarouselItem key={insight.id} className="basis-[85%] sm:basis-[280px] pl-4">
          <Card className={`bg-card ${config.border} h-full overflow-hidden relative shadow-sm hover:shadow-md transition-shadow duration-200`}>
            {/* Watermark Icon */}
            <div className="absolute -bottom-6 -right-6 opacity-[0.03] pointer-events-none">
              <WatermarkIcon className="h-28 w-28" />
            </div>
            
            <CardContent className="p-4 sm:p-5 flex flex-col h-full relative z-10">
              {/* Header with Badge */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-md ${config.bg}`}>
                    <IconComponent className={`h-3.5 w-3.5 ${config.icon}`} />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {insight_data.kpi_label || 'Status'}
                  </span>
                </div>
                <Badge 
                  variant="outline" 
                  className={`${config.badgeBg} ${config.badgeText} border-0 text-[9px] font-bold px-2 py-0.5 rounded-md`}
                >
                  {config.badge}
                </Badge>
              </div>

              {/* KPI Value - Central Focus */}
              {insight_data.kpi_value !== undefined && (
                <div className="mb-2">
                  <span className={`text-2xl sm:text-3xl font-bold tracking-tight ${config.valueColor}`}>
                    {String(insight_data.kpi_value)}
                  </span>
                </div>
              )}

              {/* Title */}
              <h4 className="font-semibold text-sm text-foreground mb-1.5 line-clamp-1">
                {insight_data.title}
              </h4>

              {/* Body - Explanation */}
              <p className="text-xs text-muted-foreground line-clamp-2 flex-1 leading-relaxed">
                {insight_data.body}
              </p>

              {/* Context Meter */}
              {kpiNumeric !== null && isACWR && (
                <ACWRMeter value={kpiNumeric} color={config.meterColor.replace('bg-', '')} />
              )}
              {kpiNumeric !== null && isEfficiency && (
                <EfficiencyMeter value={kpiNumeric} color={config.meterColor.replace('bg-', '')} />
              )}

              {/* Educational Footer */}
              <div className="mt-3 pt-2.5 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary/60" />
                  {microcopy}
                </p>
              </div>
            </CardContent>
          </Card>
        </CarouselItem>
      );
    });
  }, [insights, loading, error, isSubscribed, subscriptionLoading, navigate]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-md bg-primary/10">
          <Brain className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Insights do Coach IA
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Análise personalizada dos seus treinos
          </p>
        </div>
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
