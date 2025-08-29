import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Target } from 'lucide-react';

interface Achievement {
  title: string;
  description: string;
  icon: string;
  achievedAt: Date;
}

interface SimpleAchievementBadgeProps {
  achievement: Achievement;
}

export const SimpleAchievementBadge = ({ achievement }: SimpleAchievementBadgeProps) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'star': return Star;
      case 'target': return Target;
      default: return Trophy;
    }
  };

  const IconComponent = getIcon(achievement.icon);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
      <div className="p-2 rounded-full bg-primary/20">
        <IconComponent className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1">
        <div className="font-medium text-sm">{achievement.title}</div>
        <div className="text-xs text-muted-foreground">{achievement.description}</div>
      </div>
      <Badge variant="outline" className="text-xs">
        {achievement.achievedAt.toLocaleDateString('pt-BR')}
      </Badge>
    </div>
  );
};