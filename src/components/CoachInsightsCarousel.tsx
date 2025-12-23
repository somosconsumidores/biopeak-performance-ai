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

// Status configurations with badge text
const statusConfig: Record<InsightData['status'], {
  border: string;
  icon: string;
  bg: string;
  glow: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
  meterColor: string;
}> = {
  positive: {
    border: 'border-emerald-500/30',
    icon: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    glow: 'shadow-emerald-500/20',
    badge: 'ZONA SEGURA',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-400',
    meterColor: 'bg-emerald-500',
  },
  warning: {
    border: 'border-amber-500/30',
    icon: 'text-amber-500',
    bg: 'bg-amber-500/10',
    glow: 'shadow-amber-500/20',
    badge: 'ATENÇÃO',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-400',
    meterColor: 'bg-amber-500',
  },
  neutral: {
    border: 'border-slate-400/30',
    icon: 'text-slate-400',
    bg: 'bg-slate-400/10',
    glow: 'shadow-slate-400/10',
    badge: 'ESTÁVEL',
    badgeBg: 'bg-slate-500/20',
    badgeText: 'text-slate-300',
    meterColor: 'bg-slate-400',
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
    <div className="mt-3 space-y-1">
      <div className="relative h-2 rounded-full overflow-hidden bg-gradient-to-r from-amber-500/30 via-emerald-500/50 to-red-500/30">
        {/* Marker */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-background shadow-lg z-10"
          style={{ 
            left: `${position}%`,
            backgroundColor: color,
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/70">
        <span>Baixo</span>
        <span className="text-emerald-400/80">Ideal</span>
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
    <div className="mt-3 space-y-1">
      <div className="relative h-2 rounded-full overflow-hidden bg-gradient-to-r from-red-500/40 via-slate-500/30 to-emerald-500/40">
        {/* Marker */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-background shadow-lg z-10"
          style={{ 
            left: `${position}%`,
            backgroundColor: color,
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/70">
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
        <CarouselItem key="pro-only" className="basis-[85%] sm:basis-[320px] pl-4">
          <Card className="glass-card border-primary/30 h-full overflow-hidden relative bg-gradient-to-br from-primary/5 via-transparent to-primary/10">
            {/* Lock watermark */}
            <div className="absolute -bottom-4 -right-4 opacity-[0.05] pointer-events-none">
              <Lock className="h-32 w-32" />
            </div>
            
            <CardContent className="p-5 flex flex-col items-center justify-center min-h-[220px] text-center relative z-10">
              <div className="p-3 rounded-full bg-primary/10 mb-4">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              
              <Badge 
                variant="outline" 
                className="bg-primary/20 text-primary border-0 text-[10px] font-semibold px-3 py-1 mb-3"
              >
                CONTEÚDO PRO
              </Badge>
              
              <h4 className="font-semibold text-sm text-foreground mb-2">
                Insights do Coach IA
              </h4>
              
              <p className="text-xs text-muted-foreground mb-4 max-w-[200px]">
                Análises personalizadas e inteligentes sobre seu desempenho, exclusivo para assinantes Pro.
              </p>
              
              <Button 
                size="sm" 
                onClick={() => navigate('/paywall2')}
                className="bg-primary hover:bg-primary/90"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Desbloquear Insights
              </Button>
            </CardContent>
          </Card>
        </CarouselItem>,
      ];
    }

    // Show skeleton while loading subscription status or data for subscribers
    if (loading || subscriptionLoading) {
      return Array.from({ length: 2 }).map((_, i) => (
        <CarouselItem key={`skeleton-${i}`} className="basis-[85%] sm:basis-[320px] pl-4">
          <Card className="glass-card border-glass-border h-full overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        </CarouselItem>
      ));
    }

    if (error || insights.length === 0) {
      return [
        <CarouselItem key="empty" className="basis-[85%] sm:basis-[320px] pl-4">
          <Card className="glass-card border-glass-border h-full overflow-hidden relative">
            <CardContent className="p-5 flex flex-col items-center justify-center min-h-[200px] text-center">
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03]">
                <Brain className="h-32 w-32" />
              </div>
              <div className="relative z-10">
                <div className="p-3 rounded-full bg-primary/10 mb-3">
                  <Brain className="h-6 w-6 text-primary" />
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
        <CarouselItem key={insight.id} className="basis-[85%] sm:basis-[320px] pl-4">
          <Card className={`glass-card border ${config.border} h-full overflow-hidden relative hover:shadow-lg ${config.glow} transition-all duration-300`}>
            {/* Watermark Icon */}
            <div className="absolute -bottom-4 -right-4 opacity-[0.04] pointer-events-none">
              <WatermarkIcon className="h-32 w-32" />
            </div>
            
            <CardContent className="p-5 flex flex-col h-full relative z-10">
              {/* Header with Badge */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${config.bg}`}>
                    <IconComponent className={`h-4 w-4 ${config.icon}`} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {insight_data.kpi_label || 'Status'}
                  </span>
                </div>
                <Badge 
                  variant="outline" 
                  className={`${config.badgeBg} ${config.badgeText} border-0 text-[10px] font-semibold px-2 py-0.5`}
                >
                  {config.badge}
                </Badge>
              </div>

              {/* KPI Value - Central Focus */}
              {insight_data.kpi_value !== undefined && (
                <div className="mb-3">
                  <span className={`text-3xl font-bold ${config.icon}`}>
                    {String(insight_data.kpi_value)}
                  </span>
                </div>
              )}

              {/* Title */}
              <h4 className="font-semibold text-sm text-foreground mb-2 line-clamp-1">
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
              <div className="mt-4 pt-3 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
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
