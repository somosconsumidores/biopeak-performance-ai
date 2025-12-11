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

export function useAdminDashboardStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Call RPC function that calculates all stats directly in PostgreSQL
        const { data, error: rpcError } = await supabase.rpc('get_admin_dashboard_stats');

        if (rpcError) {
          console.error('RPC error:', rpcError);
          throw rpcError;
        }

        if (!data) {
          throw new Error('No data returned from get_admin_dashboard_stats');
        }

        console.log('Admin dashboard stats from RPC:', data);

        // Parse RPC response
        const rpcData = data as {
          total_users: number;
          garmin_tokens: number;
          strava_tokens: number;
          polar_tokens: number;
          users_with_activities: number;
          active_subscribers: number;
          users_with_phone: number;
          active_plans: number;
          avg_age_all: number | null;
          avg_age_subscribers: number | null;
          activity_sources: { source: string; count: number }[] | null;
          goal_distribution: { name: string; value: number }[] | null;
          athletic_level_distribution: { name: string; value: number }[] | null;
        };

        // Transform goal distribution with labels
        const goalDist = (rpcData.goal_distribution || []).map(g => ({
          label: goalLabels[g.name?.toLowerCase()] || g.name || 'Outro',
          value: Number(g.value) || 0
        })).sort((a, b) => b.value - a.value);

        // Transform athletic level distribution with labels
        const levelDist = (rpcData.athletic_level_distribution || []).map(l => ({
          label: levelLabels[l.name?.toLowerCase()] || l.name || 'Outro',
          value: Number(l.value) || 0
        })).sort((a, b) => b.value - a.value);

        // Transform activity sources
        const activitySources = (rpcData.activity_sources || []).map(s => ({
          source: s.source || 'unknown',
          count: Number(s.count) || 0
        })).sort((a, b) => b.count - a.count);

        setStats({
          totalUsers: rpcData.total_users || 0,
          usersWithActiveTokens: (rpcData.garmin_tokens || 0) + (rpcData.strava_tokens || 0) + (rpcData.polar_tokens || 0),
          usersWithActivities: rpcData.users_with_activities || 0,
          activeSubscribers: rpcData.active_subscribers || 0,
          usersWithPhone: rpcData.users_with_phone || 0,
          usersWithActivePlan: rpcData.active_plans || 0,
          avgAgeAll: rpcData.avg_age_all,
          avgAgeSubscribers: rpcData.avg_age_subscribers,
          onboardingDistribution: {
            goal: goalDist,
            athleticLevel: levelDist,
            aplicativo: [] // Not included in current RPC
          },
          tokenBreakdown: {
            garmin: rpcData.garmin_tokens || 0,
            polar: rpcData.polar_tokens || 0,
            strava: rpcData.strava_tokens || 0
          },
          usersByActivitySource: activitySources
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
