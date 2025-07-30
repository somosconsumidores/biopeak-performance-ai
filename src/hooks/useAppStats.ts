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

        // Use the new database function to get public stats
        const { data, error } = await supabase
          .rpc('get_app_stats');

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          const stats = data[0];
          setStats({
            totalAthletes: stats.total_athletes || 0,
            totalActivities: stats.total_activities || 0,
            totalInsights: stats.total_insights || 0,
            totalGoals: stats.total_goals || 0
          });
        }

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