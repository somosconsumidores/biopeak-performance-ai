import React from 'react';
import { toast } from 'sonner';
import { Trophy, Sparkles } from 'lucide-react';
import { AchievementWithProgress } from '@/hooks/useAchievementSystem';

interface AchievementToastProps {
  achievement: AchievementWithProgress;
  onDismiss?: () => void;
}

export const showAchievementToast = (achievement: AchievementWithProgress) => {
  toast.success(
    <div className="flex items-center gap-3 p-2">
      {/* Ícone animado */}
      <div className="relative">
        <Trophy className="h-8 w-8 text-yellow-400 animate-pulse" />
        <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-primary animate-bounce" />
      </div>
      
      {/* Conteúdo */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-yellow-400 text-sm">🎉 Nova Conquista!</span>
        </div>
        <h4 className="font-bold text-foreground">{achievement.title}</h4>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {achievement.description}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
            +{achievement.points} pontos
          </span>
        </div>
      </div>
    </div>,
    {
      duration: 6000,
      action: {
        label: 'Ver Todas',
        onClick: () => {
          // Navegar para conquistas (pode ser implementado depois)
          console.log('Ver todas as conquistas');
        }
      },
      className: 'glass-card border-yellow-400/30 bg-gradient-to-r from-yellow-400/10 to-orange-400/10',
      style: {
        background: 'hsl(var(--glass-bg))',
        backdropFilter: 'blur(20px)',
        border: '1px solid hsl(var(--yellow) / 0.3)'
      }
    }
  );
};

export const AchievementToast: React.FC<AchievementToastProps> = ({
  achievement,
  onDismiss
}) => {
  React.useEffect(() => {
    showAchievementToast(achievement);
    return () => {
      onDismiss?.();
    };
  }, [achievement, onDismiss]);

  return null;
};