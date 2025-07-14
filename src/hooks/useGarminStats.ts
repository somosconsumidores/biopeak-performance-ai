import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface GarminStats {
  activitiesCount: number;
  lastSyncAt: string | null;
  loading: boolean;
  error: string | null;
}

export function useGarminStats(): GarminStats {
  const [stats, setStats] = useState<GarminStats>({
    activitiesCount: 0,
    lastSyncAt: null,
    loading: true,
    error: null
  });
  
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setStats(prev => ({ ...prev, loading: false }));
      return;
    }

    const fetchStats = async () => {
      try {
        setStats(prev => ({ ...prev, loading: true, error: null }));

        // Buscar contagem total de atividades
        const { count, error: countError } = await supabase
          .from('garmin_activities')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (countError) {
          throw countError;
        }

        // Buscar data da última sincronização
        const { data: lastSync, error: lastSyncError } = await supabase
          .from('garmin_activities')
          .select('synced_at')
          .eq('user_id', user.id)
          .order('synced_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastSyncError) {
          throw lastSyncError;
        }

        setStats({
          activitiesCount: count || 0,
          lastSyncAt: lastSync?.synced_at || null,
          loading: false,
          error: null
        });

      } catch (error) {
        console.error('Error fetching Garmin stats:', error);
        setStats(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Erro ao carregar estatísticas'
        }));
      }
    };

    fetchStats();
  }, [user]);

  return stats;
}