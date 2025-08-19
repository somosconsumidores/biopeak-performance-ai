import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface AchievementDefinition {
  id: string;
  achievement_key: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  difficulty: string;
  points: number;
  requirement_type: string;
  requirement_value: number;
  requirement_metadata: any;
  is_active: boolean;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_key: string;
  unlocked_at: string;
  progress_value: number;
  is_seen: boolean;
  seen_at?: string;
}

export interface AchievementProgress {
  id: string;
  user_id: string;
  achievement_key: string;
  current_value: number;
  last_updated: string;
  metadata: any;
}

export interface AchievementWithProgress extends AchievementDefinition {
  unlocked?: boolean;
  unlocked_at?: string;
  progress_value?: number;
  current_progress?: number;
  is_seen?: boolean;
  progress_percentage?: number;
}

export const useAchievementSystem = () => {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<AchievementWithProgress[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar todas as conquistas com progresso do usuário
  const fetchAchievements = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Buscar definições de conquistas
      const { data: definitions, error: defError } = await supabase
        .from('achievement_definitions')
        .select('*')
        .eq('is_active', true)
        .order('difficulty', { ascending: true });

      if (defError) throw defError;

      // Buscar conquistas desbloqueadas pelo usuário
      const { data: userAchievements, error: userError } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', user.id);

      if (userError) throw userError;

      // Buscar progresso das conquistas
      const { data: progressData, error: progressError } = await supabase
        .from('achievement_progress')
        .select('*')
        .eq('user_id', user.id);

      if (progressError) throw progressError;

      // Combinar dados
      const achievementsWithProgress: AchievementWithProgress[] = definitions?.map(def => {
        const userAchievement = userAchievements?.find(ua => ua.achievement_key === def.achievement_key);
        const progress = progressData?.find(p => p.achievement_key === def.achievement_key);
        
        const progressPercentage = def.requirement_value && progress ? 
          Math.min((progress.current_value / def.requirement_value) * 100, 100) : 0;

        return {
          ...def,
          unlocked: !!userAchievement,
          unlocked_at: userAchievement?.unlocked_at,
          progress_value: userAchievement?.progress_value || 0,
          current_progress: progress?.current_value || 0,
          is_seen: userAchievement?.is_seen || false,
          progress_percentage: progressPercentage
        };
      }) || [];

      setAchievements(achievementsWithProgress);
      setUnlockedAchievements(userAchievements || []);
    } catch (err) {
      console.error('Error fetching achievements:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar conquistas');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Verificar e desbloquear conquistas automaticamente
  const checkAchievements = useCallback(async () => {
    if (!user) return;

    try {
      // Invocar edge function para verificar conquistas
      const { data, error } = await supabase.functions.invoke('calculate-achievements', {
        body: { user_id: user.id }
      });

      if (error) throw error;

      if (data?.new_achievements && data.new_achievements.length > 0) {
        // Mostrar notificações para novas conquistas
        data.new_achievements.forEach((achievement: AchievementWithProgress) => {
          toast.success('Nova Conquista Desbloqueada!', {
            description: achievement.title,
            duration: 5000,
            className: 'bg-gradient-to-r from-yellow-400/10 to-orange-400/10 border-yellow-400/20'
          });
        });

        // Recarregar conquistas
        await fetchAchievements();
      }
    } catch (err) {
      console.error('Error checking achievements:', err);
    }
  }, [user, fetchAchievements]);

  // Marcar conquista como vista
  const markAchievementAsSeen = useCallback(async (achievementKey: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_achievements')
        .update({ 
          is_seen: true, 
          seen_at: new Date().toISOString() 
        })
        .eq('user_id', user.id)
        .eq('achievement_key', achievementKey);

      if (error) throw error;

      // Atualizar estado local
      setAchievements(prev => prev.map(ach => 
        ach.achievement_key === achievementKey 
          ? { ...ach, is_seen: true }
          : ach
      ));
    } catch (err) {
      console.error('Error marking achievement as seen:', err);
    }
  }, [user]);

  // Marcar todas as conquistas como vistas
  const markAllAchievementsAsSeen = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_achievements')
        .update({ 
          is_seen: true, 
          seen_at: new Date().toISOString() 
        })
        .eq('user_id', user.id)
        .eq('is_seen', false);

      if (error) throw error;

      // Atualizar estado local
      setAchievements(prev => prev.map(ach => ({ ...ach, is_seen: true })));
    } catch (err) {
      console.error('Error marking all achievements as seen:', err);
    }
  }, [user]);

  // Estatísticas de conquistas
  const achievementStats = {
    total: achievements.length,
    unlocked: achievements.filter(a => a.unlocked).length,
    unseen: achievements.filter(a => a.unlocked && !a.is_seen).length,
    totalPoints: achievements.filter(a => a.unlocked).reduce((sum, a) => sum + a.points, 0),
    byCategory: achievements.reduce((acc, ach) => {
      if (!acc[ach.category]) {
        acc[ach.category] = { total: 0, unlocked: 0 };
      }
      acc[ach.category].total++;
      if (ach.unlocked) acc[ach.category].unlocked++;
      return acc;
    }, {} as Record<string, { total: number; unlocked: number }>)
  };

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  return {
    achievements,
    unlockedAchievements,
    loading,
    error,
    achievementStats,
    fetchAchievements,
    checkAchievements,
    markAchievementAsSeen,
    markAllAchievementsAsSeen
  };
};