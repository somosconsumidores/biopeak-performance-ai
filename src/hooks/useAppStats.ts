import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AppStats {
  totalAthletes: number;
  totalActivities: number;
  totalInsights: number;
  totalGoals: number;
}

export function useAppStats() {
  const [stats, setStats] = useState<AppStats>({
    totalAthletes: 0,
    totalActivities: 0,
    totalInsights: 0,
    totalGoals: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAppStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get total athletes (unique users in profiles table)
        const { count: athletesCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        // Get total activities from all sources
        const [garminActivities, stravaActivities, polarActivities] = await Promise.all([
          supabase.from('garmin_activities').select('*', { count: 'exact', head: true }),
          supabase.from('strava_activities').select('*', { count: 'exact', head: true }),
          supabase.from('polar_activities').select('*', { count: 'exact', head: true })
        ]);

        const totalActivities = 
          (garminActivities.count || 0) + 
          (stravaActivities.count || 0) + 
          (polarActivities.count || 0);

        // Get total insights (performance_metrics)
        const { count: insightsCount } = await supabase
          .from('performance_metrics')
          .select('*', { count: 'exact', head: true });

        // Get total goals (user_commitments)
        const { count: goalsCount } = await supabase
          .from('user_commitments')
          .select('*', { count: 'exact', head: true });

        setStats({
          totalAthletes: athletesCount || 0,
          totalActivities: totalActivities,
          totalInsights: insightsCount || 0,
          totalGoals: goalsCount || 0
        });

      } catch (error) {
        console.error('Error fetching app stats:', error);
        setError('Erro ao carregar estatísticas');
      } finally {
        setLoading(false);
      }
    };

    fetchAppStats();
  }, []);

  return { stats, loading, error };
}