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

      console.log('[useStravaSync] Starting Strava activities sync...');
      
      const { data, error } = await supabase.functions.invoke('strava-sync');
      
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
          ? `Sincronização incremental concluída: ${data.synced} novas atividades`
          : `Sincronização inicial concluída: ${data.synced} atividades`,
        synced: data.synced,
        total: data.total,
        isIncremental: data.isIncremental
      };

      setLastSyncResult(result);
      
      toast({
        title: "Sincronização concluída",
        description: result.message,
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