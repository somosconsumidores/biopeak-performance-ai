import { useEffect, useState } from 'react';
import { useStravaSync } from '@/hooks/useStravaSync';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export const useStravaBackgroundSync = () => {
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const { syncActivities } = useStravaSync();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const startBackgroundSync = async () => {
    if (isBackgroundSyncing) {
      console.log('[BackgroundSync] Already syncing, skipping...');
      return;
    }

    setIsBackgroundSyncing(true);
    console.log('[BackgroundSync] Starting optimized background sync...');

    try {
      // Start optimized sync in background without blocking UI
      const syncPromise = syncActivities(true); // Use optimized sync
      
      // Show initial toast
      toast({
        title: "Sincronização iniciada",
        description: "Suas atividades estão sendo sincronizadas em segundo plano.",
      });

      // Wait for sync completion
      const success = await syncPromise;
      
      if (success) {
        // Refresh data after successful sync
        queryClient.invalidateQueries({ queryKey: ['strava-stats'] });
        queryClient.invalidateQueries({ queryKey: ['strava-activities'] });
        
        toast({
          title: "Sincronização concluída",
          description: "Suas atividades do Strava foram sincronizadas com sucesso!",
        });
      } else {
        toast({
          title: "Problema na sincronização",
          description: "Houve um problema ao sincronizar suas atividades. Você pode tentar novamente na página de sincronização.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[BackgroundSync] Error:', error);
      toast({
        title: "Erro na sincronização",
        description: "Ocorreu um erro durante a sincronização. Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsBackgroundSyncing(false);
    }
  };

  return {
    startBackgroundSync,
    isBackgroundSyncing,
  };
};