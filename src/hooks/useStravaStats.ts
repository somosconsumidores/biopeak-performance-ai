import { useQuery } from '@tanstack/react-query';

interface StravaStats {
  isConnected: boolean;
  totalActivities: number;
  lastSyncAt: string | null;
  syncStatus: string;
  totalActivitiesSynced: number;
}

export const useStravaStats = () => {
  return useQuery({
    queryKey: ['strava-stats'],
    queryFn: async (): Promise<StravaStats> => {
      // For now, return mock data until the database tables are properly configured
      // This will be updated once the Strava tables are available in the database types
      return {
        isConnected: false,
        totalActivities: 0,
        lastSyncAt: null,
        syncStatus: 'disconnected',
        totalActivitiesSynced: 0,
      };
    },
    refetchInterval: 5000, // Refetch every 5 seconds
  });
};