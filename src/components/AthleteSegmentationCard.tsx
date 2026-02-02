import { motion } from "framer-motion";
import { 
  Rocket, 
  Gem, 
  Flame, 
  Mountain, 
  Zap, 
  Moon, 
  Sprout,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Activity,
  Timer
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAthleteSegmentation } from "@/hooks/useAthleteSegmentation";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AthleteSegmentationCardProps {
  className?: string;
}

const iconMap: Record<string, React.ElementType> = {
  rocket: Rocket,
  gem: Gem,
  flame: Flame,
  mountain: Mountain,
  zap: Zap,
  moon: Moon,
  seedling: Sprout,
};

const colorMap: Record<string, { gradient: string; bg: string; text: string; glow: string }> = {
  yellow: {
    gradient: "from-yellow-500 to-amber-500",
    bg: "bg-yellow-500/10",
    text: "text-yellow-500",
    glow: "shadow-yellow-500/20",
  },
  blue: {
    gradient: "from-blue-500 to-indigo-500",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    glow: "shadow-blue-500/20",
  },
  orange: {
    gradient: "from-orange-500 to-red-500",
    bg: "bg-orange-500/10",
    text: "text-orange-500",
    glow: "shadow-orange-500/20",
  },
  green: {
    gradient: "from-green-500 to-emerald-500",
    bg: "bg-green-500/10",
    text: "text-green-500",
    glow: "shadow-green-500/20",
  },
  purple: {
    gradient: "from-purple-500 to-violet-500",
    bg: "bg-purple-500/10",
    text: "text-purple-500",
    glow: "shadow-purple-500/20",
  },
  gray: {
    gradient: "from-gray-400 to-slate-500",
    bg: "bg-gray-500/10",
    text: "text-gray-400",
    glow: "shadow-gray-500/20",
  },
  "green-300": {
    gradient: "from-green-300 to-teal-400",
    bg: "bg-green-300/10",
    text: "text-green-400",
    glow: "shadow-green-300/20",
  },
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

const trendLabels = {
  up: "Ascendente",
  down: "Descendente",
  stable: "Estável",
};

function formatPace(paceMinKm: number | undefined): string {
  if (!paceMinKm || paceMinKm <= 0) return "N/A";
  const minutes = Math.floor(paceMinKm);
  const seconds = Math.round((paceMinKm - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function AthleteSegmentationCard({ className }: AthleteSegmentationCardProps) {
  const { data: segmentation, isLoading, error } = useAthleteSegmentation();

  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-24 w-full" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !segmentation) {
    return null; // Don't show card if no segmentation data
  }

  const IconComponent = iconMap[segmentation.badge_icon] || Gem;
  const colors = colorMap[segmentation.badge_color] || colorMap.blue;
  const TrendIcon = trendIcons[segmentation.trend];
  const metrics = segmentation.metrics_snapshot;

  return (
    <Card className={cn("overflow-hidden relative", className)}>
      {/* Gradient background glow */}
      <div 
        className={cn(
          "absolute inset-0 opacity-5 blur-3xl",
          `bg-gradient-to-br ${colors.gradient}`
        )} 
      />
      
      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Perfil de Atleta</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {format(new Date(segmentation.created_at), "dd MMM", { locale: ptBR })}
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 relative z-10">
        {/* Badge Section */}
        <div className="flex items-start gap-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className={cn(
              "relative flex h-16 w-16 items-center justify-center rounded-full",
              `bg-gradient-to-br ${colors.gradient}`,
              "shadow-lg",
              colors.glow
            )}
          >
            <IconComponent className="h-8 w-8 text-white" />
            
            {/* Animated ring */}
            <motion.div
              className={cn(
                "absolute inset-0 rounded-full border-2",
                colors.text
              )}
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.15, opacity: 0 }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity,
                ease: "easeOut"
              }}
            />
          </motion.div>

          <div className="flex-1 min-w-0">
            <motion.h4
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={cn(
                "text-xl font-bold tracking-tight",
                colors.text
              )}
            >
              {segmentation.segment_name}
            </motion.h4>
            
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2 mt-1"
            >
              <TrendIcon className={cn(
                "h-4 w-4",
                segmentation.trend === "up" && "text-green-500",
                segmentation.trend === "down" && "text-red-500",
                segmentation.trend === "stable" && "text-muted-foreground"
              )} />
              <span className="text-sm text-muted-foreground">
                Tendência: {trendLabels[segmentation.trend]}
              </span>
            </motion.div>
          </div>
        </div>

        {/* AI Explanation */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={cn(
            "rounded-lg p-4 text-sm leading-relaxed",
            colors.bg
          )}
        >
          <p className="text-foreground/90">{segmentation.ai_explanation}</p>
        </motion.div>

        {/* Metrics Summary */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap gap-4 pt-2 border-t border-border/50"
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            <span>{metrics.weekly_distance_km?.toFixed(1) || "0"} km/sem</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{metrics.weekly_frequency?.toFixed(1) || "0"} treinos</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Timer className="h-3.5 w-3.5" />
            <span>{formatPace(metrics.avg_pace_min_km)} /km</span>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
