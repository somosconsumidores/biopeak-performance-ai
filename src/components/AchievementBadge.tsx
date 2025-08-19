import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAchievementSystem } from '@/hooks/useAchievementSystem';

interface AchievementBadgeProps {
  onClick: () => void;
  className?: string;
}


export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  onClick,
  className
}) => {
  const { achievementStats, loading } = useAchievementSystem();

  if (loading || achievementStats.total === 0) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "relative h-9 w-9 glass-card hover:bg-glass-hover p-0",
        className
      )}
      aria-label={`${achievementStats.unlocked} conquistas, ${achievementStats.unseen} novas`}
    >
      <Award className="h-5 w-5 text-primary" />
      
      {/* Badge com contador de conquistas */}
      <Badge 
        variant="secondary" 
        className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs bg-primary text-primary-foreground border-background"
      >
        {achievementStats.unlocked > 99 ? '99+' : achievementStats.unlocked}
      </Badge>

      {/* Indicador de novas conquistas */}
      {achievementStats.unseen > 0 && (
        <div className="absolute -top-1 -right-1 h-3 w-3 bg-accent rounded-full animate-pulse border-2 border-background" />
      )}
    </Button>
  );
};

export default AchievementBadge;