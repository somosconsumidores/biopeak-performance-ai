import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface PolarStats {
  activitiesCount: number;
  lastSyncAt: string | null;
  deviceName: string | null;
  polarUserId: string | null;
}

export const usePolarStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<PolarStats>({
    activitiesCount: 0,
    lastSyncAt: null,
    deviceName: null,
    polarUserId: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPolarStats();
  }, [user]);

  const fetchPolarStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Use user from context instead of API call
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Get activities count
      const { count: activitiesCount, error: activitiesError } = await supabase
        .from('polar_activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (activitiesError) {
        throw new Error(`Error fetching activities: ${activitiesError.message}`);
      }

      // Get latest token info
      const { data: tokenData, error: tokenError } = await supabase
        .from('polar_tokens')
        .select('polar_user_id, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tokenError) {
        console.error('Error fetching token data:', tokenError);
      }

      // Get latest activity for last sync time
      const { data: latestActivity, error: latestActivityError } = await supabase
        .from('polar_activities')
        .select('synced_at')
        .eq('user_id', user.id)
        .order('synced_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestActivityError) {
        console.error('Error fetching latest activity:', latestActivityError);
      }

      // Get latest sync control record
      const { data: syncControl, error: syncError } = await supabase
        .from('polar_sync_control')
        .select('last_sync_at')
        .eq('user_id', user.id)
        .order('last_sync_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (syncError) {
        console.error('Error fetching sync control:', syncError);
      }

      const lastSyncAt = latestActivity?.synced_at || syncControl?.last_sync_at || null;

      setStats({
        activitiesCount: activitiesCount || 0,
        lastSyncAt,
        deviceName: 'Polar Device', // Polar API doesn't provide device name directly
        polarUserId: tokenData?.polar_user_id || null,
      });

    } catch (error) {
      console.error('Error fetching Polar stats:', error);
      setError(error instanceof Error ? error.message : 'Error fetching Polar stats');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    stats,
    isLoading,
    error,
    refetch: fetchPolarStats,
  };
};
