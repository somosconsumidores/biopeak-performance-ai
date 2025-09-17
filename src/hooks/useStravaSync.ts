import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncResult {
  message: string;
  synced: number;
  total: number;
  isIncremental?: boolean;
}

export const useStravaSync = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const { toast } = useToast();

  const syncActivities = async (): Promise<boolean> => {
    setIsLoading(true);
    setLastSyncResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para sincronizar atividades.",
          variant: "destructive",
        });
        return false;
      }

      console.log('[useStravaSync] Starting optimized Strava activities sync...');
      
      // Use the new optimized sync function
      const { data, error } = await supabase.functions.invoke('strava-sync-optimized', {
        body: {
          maxActivities: 50, // Start with recent activities only
          maxTimeMinutes: 2, // Limit to 2 minutes max
          background: false
        }
      });
      
      if (error) {
        console.error('[useStravaSync] Sync error:', error);
        toast({
          title: "Erro na sincronização",
          description: error.message || "Falha ao sincronizar atividades do Strava",
          variant: "destructive",
        });
        return false;
      }

      if (!data?.success) {
        toast({
          title: "Falha na sincronização",
          description: data?.error || "Erro desconhecido durante a sincronização",
          variant: "destructive",
        });
        return false;
      }

      const result: SyncResult = {
        message: data.isIncremental 
          ? `Sincronização incremental: ${data.synced} novas atividades`
          : `Sincronização inicial: ${data.synced} atividades recentes`,
        synced: data.synced,
        total: data.total,
        isIncremental: data.isIncremental
      };

      setLastSyncResult(result);
      
      // Show different messages based on sync type
      const toastMessage = data.isIncremental 
        ? `${data.synced} novas atividades sincronizadas!`
        : `${data.synced} atividades recentes sincronizadas! Atividades mais antigas serão sincronizadas gradualmente.`;
      
      toast({
        title: "Sincronização concluída",
        description: toastMessage,
      });

      console.log('[useStravaSync] Sync completed:', data);
      return true;

    } catch (error) {
      console.error('[useStravaSync] Unexpected error:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado durante a sincronização.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    syncActivities,
    isLoading,
    lastSyncResult,
  };
};