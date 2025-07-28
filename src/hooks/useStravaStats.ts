import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface StravaStats {
  isConnected: boolean;
  totalActivities: number;
  lastSyncAt: string | null;
  syncStatus: string;
  totalActivitiesSynced: number;
}

export const useStravaStats = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['strava-stats', user?.id],
    queryFn: async (): Promise<StravaStats> => {
      if (!user) {
        return {
          isConnected: false,
          totalActivities: 0,
          lastSyncAt: null,
          syncStatus: 'disconnected',
          totalActivitiesSynced: 0,
        };
      }

      try {
        // Check if user has valid Strava tokens
        const { data: tokenData } = await supabase
          .from('strava_tokens')
          .select('access_token, expires_at')
          .eq('user_id', user.id)
          .maybeSingle();

        const isConnected = !!(tokenData?.access_token && 
          new Date(tokenData.expires_at) > new Date());

        if (!isConnected) {
          return {
            isConnected: false,
            totalActivities: 0,
            lastSyncAt: null,
            syncStatus: 'disconnected',
            totalActivitiesSynced: 0,
          };
        }

        // Get total activities count
        const { count: totalActivities } = await supabase
          .from('strava_activities')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Get sync status
        const { data: syncStatus } = await supabase
          .from('strava_sync_status')
          .select('sync_status, last_sync_at, total_activities_synced')
          .eq('user_id', user.id)
          .maybeSingle();

        return {
          isConnected: true,
          totalActivities: totalActivities || 0,
          lastSyncAt: syncStatus?.last_sync_at || null,
          syncStatus: syncStatus?.sync_status || 'idle',
          totalActivitiesSynced: syncStatus?.total_activities_synced || 0,
        };

      } catch (error) {
        console.error('Error fetching Strava stats:', error);
        return {
          isConnected: false,
          totalActivities: 0,
          lastSyncAt: null,
          syncStatus: 'error',
          totalActivitiesSynced: 0,
        };
      }
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
};