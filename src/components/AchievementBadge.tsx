import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award, Trophy, Target, Zap, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: 'award' | 'trophy' | 'target' | 'zap' | 'star';
  color: 'gold' | 'silver' | 'bronze' | 'blue' | 'green';
  unread?: boolean;
}

interface AchievementBadgeProps {
  achievements: Achievement[];
  unreadCount: number;
  onClick: () => void;
  className?: string;
}

const ICON_MAP = {
  award: Award,
  trophy: Trophy,
  target: Target,
  zap: Zap,
  star: Star
};

const COLOR_MAP = {
  gold: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  silver: 'text-gray-300 bg-gray-300/10 border-gray-300/20',
  bronze: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  green: 'text-green-400 bg-green-400/10 border-green-400/20'
};

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  achievements,
  unreadCount,
  onClick,
  className
}) => {
  if (achievements.length === 0) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "relative h-9 w-9 glass-card hover:bg-glass-hover p-0",
        className
      )}
      aria-label={`${achievements.length} conquistas, ${unreadCount} novas`}
    >
      <Award className="h-5 w-5 text-primary" />
      
      {/* Badge com contador de conquistas */}
      <Badge 
        variant="secondary" 
        className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs bg-primary text-primary-foreground border-background"
      >
        {achievements.length > 99 ? '99+' : achievements.length}
      </Badge>

      {/* Indicador de novas conquistas */}
      {unreadCount > 0 && (
        <div className="absolute -top-1 -right-1 h-3 w-3 bg-accent rounded-full animate-pulse border-2 border-background" />
      )}
    </Button>
  );
};

export default AchievementBadge;