import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface BackgroundSyncState {
  isRunning: boolean;
  progress: number;
  currentActivity: string;
  totalActivities: number;
  syncedActivities: number;
  errorCount: number;
}

export const useStravaBackgroundSync = () => {
  const [syncState, setSyncState] = useState<BackgroundSyncState>({
    isRunning: false,
    progress: 0,
    currentActivity: '',
    totalActivities: 0,
    syncedActivities: 0,
    errorCount: 0
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const startBackgroundSync = async (): Promise<boolean> => {
    setSyncState(prev => ({ ...prev, isRunning: true, progress: 0 }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('[BackgroundSync] No session found');
        return false;
      }

      console.log('[BackgroundSync] Starting background sync...');
      
      // Start the sync in background with progress updates
      const { data, error } = await supabase.functions.invoke('strava-sync-optimized', {
        body: { 
          background: true,
          maxActivities: 100, // Allow more activities for background sync
          maxTimeMinutes: 3 // Slightly longer timeout for background
        }
      });
      
      if (error) {
        console.error('[BackgroundSync] Sync error:', error);
        setSyncState(prev => ({ ...prev, isRunning: false }));
        
        // Show non-intrusive error notification
        toast({
          title: "Sincronização em segundo plano",
          description: "Houve um problema na sincronização. Tentaremos novamente mais tarde.",
          variant: "default",
        });
        
        return false;
      }

      if (data?.success) {
        setSyncState(prev => ({ 
          ...prev, 
          isRunning: false,
          progress: 100,
          syncedActivities: data.synced || 0,
          totalActivities: data.total || 0
        }));
        
        // Show success notification only if significant activities were synced
        if (data.synced > 0) {
          toast({
            title: "Sincronização concluída",
            description: `${data.synced} atividades sincronizadas com sucesso!`,
          });
        }
        
        // Refresh queries
        queryClient.invalidateQueries({ queryKey: ['strava-stats'] });
        queryClient.invalidateQueries({ queryKey: ['strava-activities'] });
        
        return true;
      }

      return false;

    } catch (error) {
      console.error('[BackgroundSync] Unexpected error:', error);
      setSyncState(prev => ({ ...prev, isRunning: false }));
      return false;
    }
  };

  // Check for ongoing sync status on mount
  useEffect(() => {
    const checkSyncStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Check if there's an ongoing sync
        const { data: stats } = await supabase.functions.invoke('strava-stats');
        
        if (stats?.syncStatus === 'in_progress') {
          setSyncState(prev => ({ 
            ...prev, 
            isRunning: true,
            currentActivity: 'Verificando status...'
          }));
          
          // Check again in a few seconds
          setTimeout(checkSyncStatus, 5000);
        }
      } catch (error) {
        console.warn('[BackgroundSync] Status check error:', error);
      }
    };

    checkSyncStatus();
  }, []);

  return {
    syncState,
    startBackgroundSync,
    isRunning: syncState.isRunning
  };
};