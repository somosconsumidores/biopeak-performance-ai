import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { Award, Trophy, Target, Zap, Star, Sparkles } from 'lucide-react';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: 'award' | 'trophy' | 'target' | 'zap' | 'star';
  color: 'gold' | 'silver' | 'bronze' | 'blue' | 'green';
}

interface AchievementNotificationProps {
  achievement: Achievement;
  onDismiss?: () => void;
}

const ICON_MAP = {
  award: Award,
  trophy: Trophy,
  target: Target,
  zap: Zap,
  star: Star
};

const COLOR_MAP = {
  gold: 'text-yellow-400',
  silver: 'text-gray-300',
  bronze: 'text-orange-400',
  blue: 'text-blue-400',
  green: 'text-green-400'
};

export const AchievementNotification: React.FC<AchievementNotificationProps> = ({
  achievement,
  onDismiss
}) => {
  const IconComponent = ICON_MAP[achievement.icon];
  const iconColor = COLOR_MAP[achievement.color];

  useEffect(() => {
    const toastId = toast.success(
      <div className="flex items-center gap-3 p-2">
        {/* Ícone da conquista */}
        <div className="relative">
          <IconComponent className={`h-8 w-8 ${iconColor}`} />
          <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-primary animate-pulse" />
        </div>
        
        {/* Conteúdo */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Nova Conquista!</span>
            <div className="h-1 w-1 bg-muted-foreground rounded-full" />
            <span className="text-xs text-muted-foreground">🎉</span>
          </div>
          <h4 className="font-bold text-foreground">{achievement.title}</h4>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {achievement.description}
          </p>
        </div>
      </div>,
      {
        duration: 5000,
        action: {
          label: 'Ver todas',
          onClick: () => {
            // Aqui você pode abrir o modal de conquistas
            onDismiss?.();
          }
        },
        className: 'glass-card border-glass-border',
        style: {
          background: 'hsl(var(--glass-bg))',
          backdropFilter: 'blur(20px)',
          border: '1px solid hsl(var(--glass-border))'
        }
      }
    );

    return () => {
      toast.dismiss(toastId);
    };
  }, [achievement, iconColor, onDismiss]);

  return null;
};

// Hook para disparar notificações de conquistas
export const useAchievementNotifications = () => {
  const showAchievementNotification = (achievement: Achievement) => {
    return <AchievementNotification achievement={achievement} />;
  };

  return { showAchievementNotification };
};

export default AchievementNotification;