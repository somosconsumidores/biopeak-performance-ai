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
      console.log("🔍 [useStravaStats] Fetching Strava stats for user:", user?.id);

      if (!user) {
        console.log("ℹ️ [useStravaStats] No user found");
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
        const { data: tokenData, error: tokenError } = await supabase
          .from('strava_tokens')
          .select('access_token, expires_at')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log("🔍 [useStravaStats] Token query result:", { 
          hasToken: !!tokenData, 
          tokenError: tokenError?.message,
          expiresAt: tokenData?.expires_at 
        });

        if (tokenError) {
          console.error("❌ [useStravaStats] Token query error:", tokenError);
        }

        const isConnected = !!(tokenData?.access_token && 
          (!tokenData.expires_at || new Date(tokenData.expires_at) > new Date()));

        console.log("🔍 [useStravaStats] Connection status:", { 
          isConnected,
          hasAccessToken: !!tokenData?.access_token,
          tokenExpired: tokenData?.expires_at ? new Date(tokenData.expires_at) <= new Date() : false
        });

        if (!isConnected) {
          console.log("ℹ️ [useStravaStats] User not connected to Strava");
          return {
            isConnected: false,
            totalActivities: 0,
            lastSyncAt: null,
            syncStatus: 'disconnected',
            totalActivitiesSynced: 0,
          };
        }

        // Get total activities count
        const { count: totalActivities, error: activitiesError } = await supabase
          .from('strava_activities')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        console.log("🔍 [useStravaStats] Activities count:", { 
          totalActivities, 
          activitiesError: activitiesError?.message 
        });

        // Get sync status with detailed logging
        const { data: syncStatus, error: syncError } = await supabase
          .from('strava_sync_status')
          .select('sync_status, last_sync_at, total_activities_synced')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log("🔍 [useStravaStats] Sync status query result:", { 
          hasSyncData: !!syncStatus, 
          syncError: syncError?.message,
          syncStatus: syncStatus?.sync_status,
          lastSyncAt: syncStatus?.last_sync_at,
          totalSynced: syncStatus?.total_activities_synced
        });

        const result = {
          isConnected: true,
          totalActivities: totalActivities || 0,
          lastSyncAt: syncStatus?.last_sync_at || null,
          syncStatus: syncStatus?.sync_status || 'idle',
          totalActivitiesSynced: syncStatus?.total_activities_synced || 0,
        };

        console.log("✅ [useStravaStats] Final result:", result);
        return result;

      } catch (error) {
        console.error('❌ [useStravaStats] Error fetching Strava stats:', error);
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
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
};