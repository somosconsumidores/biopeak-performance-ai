import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingDistribution {
  goal: { label: string; value: number }[];
  athleticLevel: { label: string; value: number }[];
  aplicativo: { label: string; value: number }[];
}

interface AdminStats {
  totalUsers: number;
  usersWithActiveTokens: number;
  usersWithActivities: number;
  activeSubscribers: number;
  usersWithPhone: number;
  usersWithActivePlan: number;
  avgAgeAll: number | null;
  avgAgeSubscribers: number | null;
  onboardingDistribution: OnboardingDistribution;
  tokenBreakdown: {
    garmin: number;
    polar: number;
    strava: number;
  };
  usersByActivitySource: { source: string; count: number }[];
}

export function useAdminDashboardStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Total users in profiles
        const { count: totalUsers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        // 2. Users with active tokens (Garmin, Strava, Polar) - fetch user_ids
        const [garminTokens, stravaTokens, polarTokens] = await Promise.all([
          supabase.from('garmin_tokens').select('user_id').eq('is_active', true),
          supabase.from('strava_tokens').select('user_id').not('access_token', 'is', null),
          supabase.from('polar_tokens').select('user_id').eq('is_active', true),
        ]);

        const garminUserIds = new Set((garminTokens.data || []).map(t => t.user_id));
        const stravaUserIds = new Set((stravaTokens.data || []).map(t => t.user_id));
        const polarUserIds = new Set((polarTokens.data || []).map(t => t.user_id));

        const allTokenUserIds = new Set<string>();
        garminUserIds.forEach(id => allTokenUserIds.add(id));
        stravaUserIds.forEach(id => allTokenUserIds.add(id));
        polarUserIds.forEach(id => allTokenUserIds.add(id));

        // 3. Users with activities (unique users in all_activities)
        const { data: activityData } = await supabase
          .from('all_activities')
          .select('user_id, activity_source');

        const uniqueActivityUsers = new Set((activityData || []).map(a => a.user_id));

        // Calculate users by activity source
        const sourceUserMap: Record<string, Set<string>> = {};
        (activityData || []).forEach(a => {
          if (!sourceUserMap[a.activity_source]) {
            sourceUserMap[a.activity_source] = new Set();
          }
          sourceUserMap[a.activity_source].add(a.user_id);
        });

        const usersByActivitySource = Object.entries(sourceUserMap)
          .map(([source, users]) => ({ source, count: users.size }))
          .sort((a, b) => b.count - a.count);

        // 4. Active subscribers (subscribed = true in subscribers table)
        const { data: subscribers } = await supabase
          .from('subscribers')
          .select('user_id')
          .eq('subscribed', true);

        const activeSubscriberIds = new Set((subscribers || []).map(s => s.user_id));

        // 5. Users with phone
        const { count: usersWithPhone } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .not('phone', 'is', null)
          .neq('phone', '');

        // 6. Users with active training plans (status = 'active')
        const { data: activePlans } = await supabase
          .from('training_plans')
          .select('user_id')
          .eq('status', 'active');

        const uniqueActivePlanUsers = new Set((activePlans || []).map(p => p.user_id));

        // 7. Average age - all users with birth_date
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('user_id, birth_date')
          .not('birth_date', 'is', null);

        const calculateAge = (birthDate: string): number => {
          const today = new Date();
          const birth = new Date(birthDate);
          let age = today.getFullYear() - birth.getFullYear();
          const monthDiff = today.getMonth() - birth.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
          }
          return age;
        };

        let avgAgeAll: number | null = null;
        if (allProfiles && allProfiles.length > 0) {
          const ages = allProfiles.filter(p => p.birth_date).map(p => calculateAge(p.birth_date!));
          if (ages.length > 0) {
            avgAgeAll = Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10;
          }
        }

        // 8. Average age - subscribers only (from subscribers table with subscribed=true)
        let avgAgeSubscribers: number | null = null;
        if (activeSubscriberIds.size > 0 && allProfiles) {
          const subscriberProfiles = allProfiles.filter(p => activeSubscriberIds.has(p.user_id) && p.birth_date);
          if (subscriberProfiles.length > 0) {
            const ages = subscriberProfiles.map(p => calculateAge(p.birth_date!));
            avgAgeSubscribers = Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10;
          }
        }

        // 9. Onboarding distributions from user_onboarding table
        const { data: onboardingData } = await supabase
          .from('user_onboarding')
          .select('goal, athletic_level, aplicativo');

        const goalCounts: Record<string, number> = {};
        const levelCounts: Record<string, number> = {};
        const appCounts: Record<string, number> = {};

        (onboardingData || []).forEach(row => {
          if (row.goal) {
            const key = row.goal.toLowerCase().trim();
            goalCounts[key] = (goalCounts[key] || 0) + 1;
          }
          if (row.athletic_level) {
            const key = row.athletic_level.toLowerCase().trim();
            levelCounts[key] = (levelCounts[key] || 0) + 1;
          }
          if (row.aplicativo) {
            const key = row.aplicativo.toLowerCase().trim();
            appCounts[key] = (appCounts[key] || 0) + 1;
          }
        });

        // Goal labels mapping
        const goalLabels: Record<string, string> = {
          'analysis': 'Análise de Dados',
          'improve_times': 'Melhorar Tempos',
          'general_training': 'Treino Geral',
          'weight_loss': 'Perda de Peso',
          'specific_goal': 'Objetivo Específico',
          'fitness': 'Condicionamento',
          'lifestyle': 'Estilo de Vida',
          'other': 'Outro'
        };

        const levelLabels: Record<string, string> = {
          'beginner': 'Iniciante',
          'intermediate': 'Intermediário',
          'advanced': 'Avançado',
          'elite': 'Elite'
        };

        const onboardingGoal = Object.entries(goalCounts)
          .map(([key, value]) => ({ label: goalLabels[key] || key, value }))
          .sort((a, b) => b.value - a.value);

        const onboardingLevel = Object.entries(levelCounts)
          .map(([key, value]) => ({ label: levelLabels[key] || key, value }))
          .sort((a, b) => b.value - a.value);

        const onboardingApp = Object.entries(appCounts)
          .map(([key, value]) => ({ label: key, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);

        setStats({
          totalUsers: totalUsers || 0,
          usersWithActiveTokens: allTokenUserIds.size,
          usersWithActivities: uniqueActivityUsers.size,
          activeSubscribers: activeSubscriberIds.size,
          usersWithPhone: usersWithPhone || 0,
          usersWithActivePlan: uniqueActivePlanUsers.size,
          avgAgeAll,
          avgAgeSubscribers,
          onboardingDistribution: {
            goal: onboardingGoal,
            athleticLevel: onboardingLevel,
            aplicativo: onboardingApp
          },
          tokenBreakdown: {
            garmin: garminUserIds.size,
            polar: polarUserIds.size,
            strava: stravaUserIds.size
          },
          usersByActivitySource
        });
      } catch (err) {
        console.error('Error fetching admin stats:', err);
        setError('Erro ao carregar estatísticas');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}