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
    zepp: number;
  };
  activitySourceBreakdown: {
    garmin: number;
    polar: number;
    strava: number;
    gpx: number;
    healthkit: number;
  };
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

        // Fetch all stats in parallel
        const [
          profilesResult,
          garminTokensResult,
          polarTokensResult,
          stravaTokensResult,
          zeppTokensResult,
          activitiesResult,
          subscribersResult,
          phonesResult,
          trainingPlansResult,
          agesResult,
          goalResult,
          levelResult,
          appResult,
          activitySourcesResult
        ] = await Promise.all([
          // Total users
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          // Garmin tokens
          supabase.from('garmin_tokens').select('user_id', { count: 'exact', head: true }).eq('is_active', true),
          // Polar tokens
          supabase.from('polar_tokens').select('user_id', { count: 'exact', head: true }),
          // Strava tokens
          supabase.from('strava_tokens').select('user_id', { count: 'exact', head: true }),
          // Zepp tokens
          supabase.from('zepp_tokens').select('user_id', { count: 'exact', head: true }),
          // Users with activities
          supabase.from('all_activities').select('user_id'),
          // Active subscribers
          supabase.from('subscribers').select('id', { count: 'exact', head: true }).eq('subscribed', true),
          // Users with phone
          supabase.from('profiles').select('id', { count: 'exact', head: true }).not('phone', 'is', null).neq('phone', ''),
          // Users with active training plan
          supabase.from('training_plans').select('user_id').eq('status', 'active'),
          // Ages - get profiles with birth_date
          supabase.from('profiles').select('id, birth_date'),
          // Goal distribution
          supabase.from('user_onboarding').select('goal').not('goal', 'is', null),
          // Athletic level distribution
          supabase.from('user_onboarding').select('athletic_level').not('athletic_level', 'is', null),
          // App distribution
          supabase.from('user_onboarding').select('aplicativo').not('aplicativo', 'is', null),
          // Activity sources breakdown
          supabase.from('all_activities').select('user_id, activity_source')
        ]);

        // Get subscriber user IDs for age calculation
        const subscriberIds = await supabase.from('subscribers').select('user_id').eq('subscribed', true);

        // Calculate unique users with activities
        const uniqueActivityUsers = new Set((activitiesResult.data || []).map(a => a.user_id));

        // Calculate unique users with active training plans
        const uniquePlanUsers = new Set((trainingPlansResult.data || []).map(p => p.user_id));

        // Calculate ages
        const profilesWithAge = (agesResult.data || []).filter(p => p.birth_date);
        const calculateAge = (birthDate: string) => {
          const today = new Date();
          const birth = new Date(birthDate);
          let age = today.getFullYear() - birth.getFullYear();
          const monthDiff = today.getMonth() - birth.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
          }
          return age;
        };

        const allAges = profilesWithAge.map(p => calculateAge(p.birth_date));
        const avgAgeAll = allAges.length > 0 ? allAges.reduce((a, b) => a + b, 0) / allAges.length : null;

        const subscriberUserIds = new Set((subscriberIds.data || []).map(s => s.user_id));
        const subscriberAges = profilesWithAge
          .filter(p => subscriberUserIds.has(p.id))
          .map(p => calculateAge(p.birth_date));
        const avgAgeSubscribers = subscriberAges.length > 0 
          ? subscriberAges.reduce((a, b) => a + b, 0) / subscriberAges.length 
          : null;

        // Process onboarding distributions
        const processDistribution = (data: any[], field: string): { label: string; value: number }[] => {
          const counts: Record<string, number> = {};
          (data || []).forEach(item => {
            const value = item[field];
            if (value) {
              // Normalize the value (lowercase, trim)
              const normalized = value.toString().toLowerCase().trim();
              counts[normalized] = (counts[normalized] || 0) + 1;
            }
          });
          return Object.entries(counts)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value);
        };

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

        const goalDist = processDistribution(goalResult.data || [], 'goal').map(item => ({
          label: goalLabels[item.label] || item.label,
          value: item.value
        }));

        const levelDist = processDistribution(levelResult.data || [], 'athletic_level').map(item => ({
          label: levelLabels[item.label] || item.label,
          value: item.value
        }));

        // Process activity sources
        const activitySources = (activitySourcesResult.data || []).reduce((acc, item) => {
          const source = item.activity_source?.toLowerCase() || 'unknown';
          if (!acc[source]) acc[source] = new Set();
          acc[source].add(item.user_id);
          return acc;
        }, {} as Record<string, Set<string>>);

        // Calculate unique users with any active token
        const allTokenUsers = new Set<string>();
        // We need to fetch actual user_ids for tokens
        const [garminUsers, polarUsers, stravaUsers, zeppUsers] = await Promise.all([
          supabase.from('garmin_tokens').select('user_id').eq('is_active', true),
          supabase.from('polar_tokens').select('user_id'),
          supabase.from('strava_tokens').select('user_id'),
          supabase.from('zepp_tokens').select('user_id')
        ]);

        (garminUsers.data || []).forEach(t => allTokenUsers.add(t.user_id));
        (polarUsers.data || []).forEach(t => allTokenUsers.add(t.user_id));
        (stravaUsers.data || []).forEach(t => allTokenUsers.add(t.user_id));
        (zeppUsers.data || []).forEach(t => allTokenUsers.add(t.user_id));

        setStats({
          totalUsers: profilesResult.count || 0,
          usersWithActiveTokens: allTokenUsers.size,
          usersWithActivities: uniqueActivityUsers.size,
          activeSubscribers: subscribersResult.count || 0,
          usersWithPhone: phonesResult.count || 0,
          usersWithActivePlan: uniquePlanUsers.size,
          avgAgeAll: avgAgeAll ? Math.round(avgAgeAll * 10) / 10 : null,
          avgAgeSubscribers: avgAgeSubscribers ? Math.round(avgAgeSubscribers * 10) / 10 : null,
          onboardingDistribution: {
            goal: goalDist,
            athleticLevel: levelDist,
            aplicativo: processDistribution(appResult.data || [], 'aplicativo').slice(0, 10)
          },
          tokenBreakdown: {
            garmin: garminTokensResult.count || 0,
            polar: polarTokensResult.count || 0,
            strava: stravaTokensResult.count || 0,
            zepp: zeppTokensResult.count || 0
          },
          activitySourceBreakdown: {
            garmin: activitySources['garmin']?.size || 0,
            polar: activitySources['polar']?.size || 0,
            strava: activitySources['strava']?.size || 0,
            gpx: activitySources['gpx']?.size || 0,
            healthkit: activitySources['healthkit']?.size || 0
          }
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

  return { stats, loading, error, refetch: () => {} };
}
