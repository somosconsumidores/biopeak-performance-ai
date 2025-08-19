import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Trophy, Award, Target, Zap, Star, Crown, Calendar, 
  CalendarCheck, CalendarHeart, Activity, Flag, Plane,
  Map, Sunrise, Moon, Play
} from 'lucide-react';
import { useAchievementSystem, AchievementWithProgress } from '@/hooks/useAchievementSystem';
import { cn } from '@/lib/utils';

const ICON_MAP = {
  award: Award,
  trophy: Trophy,
  target: Target,
  zap: Zap,
  star: Star,
  crown: Crown,
  calendar: Calendar,
  'calendar-check': CalendarCheck,
  'calendar-heart': CalendarHeart,
  activity: Activity,
  flag: Flag,
  plane: Plane,
  map: Map,
  sunrise: Sunrise,
  moon: Moon,
  play: Play
};

const COLOR_MAP = {
  gold: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  silver: 'text-gray-300 bg-gray-300/10 border-gray-300/20',
  bronze: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  green: 'text-green-400 bg-green-400/10 border-green-400/20',
  purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  orange: 'text-orange-400 bg-orange-400/10 border-orange-400/20'
};

const DIFFICULTY_MAP = {
  easy: { label: 'Fácil', color: 'bg-green-500' },
  medium: { label: 'Médio', color: 'bg-yellow-500' },
  hard: { label: 'Difícil', color: 'bg-red-500' }
};

interface AchievementSectionProps {
  showHeader?: boolean;
  maxItems?: number;
  showProgress?: boolean;
  compact?: boolean;
}

const AchievementCard: React.FC<{ 
  achievement: AchievementWithProgress; 
  compact?: boolean;
  showProgress?: boolean;
}> = ({ achievement, compact = false, showProgress = true }) => {
  const IconComponent = ICON_MAP[achievement.icon as keyof typeof ICON_MAP] || Award;
  const colorClasses = COLOR_MAP[achievement.color as keyof typeof COLOR_MAP] || COLOR_MAP.blue;
  const difficulty = DIFFICULTY_MAP[achievement.difficulty as keyof typeof DIFFICULTY_MAP] || DIFFICULTY_MAP.easy;

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-200",
      achievement.unlocked 
        ? "bg-gradient-to-br from-glass-bg/50 to-background border-glass-border" 
        : "bg-muted/30 border-muted-foreground/20",
      compact ? "p-3" : "p-4"
    )}>
      <CardContent className={cn("p-0", compact ? "space-y-2" : "space-y-3")}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "rounded-full p-2 border",
              achievement.unlocked ? colorClasses : "text-muted-foreground bg-muted border-muted-foreground/20"
            )}>
              <IconComponent className={cn("h-5 w-5", compact ? "h-4 w-4" : "")} />
            </div>
            <div className="flex-1">
              <h4 className={cn(
                "font-semibold",
                achievement.unlocked ? "text-foreground" : "text-muted-foreground",
                compact ? "text-sm" : "text-base"
              )}>
                {achievement.title}
              </h4>
              {!compact && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {achievement.description}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {achievement.unlocked && !achievement.is_seen && (
              <div className="h-2 w-2 bg-accent rounded-full animate-pulse" />
            )}
            <Badge variant="outline" className={cn(
              "text-xs",
              achievement.unlocked ? "border-primary/20" : "border-muted-foreground/20"
            )}>
              {achievement.points}pts
            </Badge>
          </div>
        </div>

        {/* Progress */}
        {showProgress && !achievement.unlocked && achievement.progress_percentage !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                Progresso: {achievement.current_progress || 0}/{achievement.requirement_value}
              </span>
              <span className="text-xs text-muted-foreground">
                {Math.round(achievement.progress_percentage)}%
              </span>
            </div>
            <Progress value={achievement.progress_percentage} className="h-2" />
          </div>
        )}

        {/* Tags */}
        {!compact && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {achievement.category}
            </Badge>
            <div className={cn(
              "h-2 w-2 rounded-full",
              difficulty.color
            )} title={difficulty.label} />
            {achievement.unlocked && achievement.unlocked_at && (
              <span className="text-xs text-muted-foreground">
                {new Date(achievement.unlocked_at).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const AchievementSection: React.FC<AchievementSectionProps> = ({
  showHeader = true,
  maxItems,
  showProgress = true,
  compact = false
}) => {
  const { achievements, loading, error, achievementStats, markAllAchievementsAsSeen } = useAchievementSystem();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Suas Conquistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Suas Conquistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Erro ao carregar conquistas</p>
        </CardContent>
      </Card>
    );
  }

  const displayedAchievements = maxItems ? achievements.slice(0, maxItems) : achievements;
  const unlockedAchievements = achievements.filter(a => a.unlocked);
  const recentAchievements = unlockedAchievements
    .sort((a, b) => new Date(b.unlocked_at || 0).getTime() - new Date(a.unlocked_at || 0).getTime())
    .slice(0, maxItems || 6);

  return (
    <Card className="glass-card">
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Suas Conquistas
            </CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-primary/10">
                {achievementStats.unlocked}/{achievementStats.total}
              </Badge>
              {achievementStats.unseen > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAchievementsAsSeen}
                  className="text-xs"
                >
                  Marcar como vistas
                </Button>
              )}
            </div>
          </div>
          
          {/* Stats Summary */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{achievementStats.totalPoints} pontos</span>
            {achievementStats.unseen > 0 && (
              <Badge variant="secondary" className="bg-accent/20">
                {achievementStats.unseen} novas
              </Badge>
            )}
          </div>
        </CardHeader>
      )}
      
      <CardContent className={cn(showHeader ? "" : "pt-6")}>
        {achievements.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Complete atividades para desbloquear conquistas!
            </p>
          </div>
        ) : (
          <ScrollArea className={maxItems ? "h-96" : "h-full"}>
            <div className={cn(
              "space-y-3",
              compact ? "space-y-2" : ""
            )}>
              {/* Conquistas Recentes */}
              {unlockedAchievements.length > 0 && (
                <>
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                    Recentes
                  </h4>
                  {recentAchievements.map((achievement) => (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      compact={compact}
                      showProgress={showProgress}
                    />
                  ))}
                </>
              )}

              {/* Conquistas em Progresso */}
              {achievements.filter(a => !a.unlocked && (a.progress_percentage || 0) > 0).length > 0 && (
                <>
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mt-6">
                    Em Progresso
                  </h4>
                  {achievements
                    .filter(a => !a.unlocked && (a.progress_percentage || 0) > 0)
                    .sort((a, b) => (b.progress_percentage || 0) - (a.progress_percentage || 0))
                    .slice(0, maxItems ? 3 : undefined)
                    .map((achievement) => (
                      <AchievementCard
                        key={achievement.id}
                        achievement={achievement}
                        compact={compact}
                        showProgress={showProgress}
                      />
                    ))}
                </>
              )}

              {/* Conquistas Bloqueadas */}
              {!maxItems && achievements.filter(a => !a.unlocked && (a.progress_percentage || 0) === 0).length > 0 && (
                <>
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mt-6">
                    A Desbloquear
                  </h4>
                  {achievements
                    .filter(a => !a.unlocked && (a.progress_percentage || 0) === 0)
                    .slice(0, 5)
                    .map((achievement) => (
                      <AchievementCard
                        key={achievement.id}
                        achievement={achievement}
                        compact={compact}
                        showProgress={false}
                      />
                    ))}
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};