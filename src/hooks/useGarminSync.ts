
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SyncResult {
  message: string;
  synced: number;
  total: number;
}

interface SyncError {
  error: string;
  details?: string;
}

export const useGarminSync = () => {
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

      console.log('[useGarminSync] Starting manual activities sync...');
      
      const { data, error } = await supabase.functions.invoke('sync-garmin-activities', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          manual_sync: true
        }
      });

      if (error) {
        console.error('[useGarminSync] Function error:', error);
        toast({
          title: "Erro na sincronização",
          description: "Falha ao sincronizar atividades. Tente novamente.",
          variant: "destructive",
        });
        return false;
      }

      if (data.error) {
        const errorData = data as SyncError;
        console.error('[useGarminSync] API error:', errorData);
        
        if (errorData.error.includes('token expired')) {
          toast({
            title: "Token expirado",
            description: "Seu token Garmin expirou. Reconecte sua conta Garmin.",
            variant: "destructive",
          });
        } else if (errorData.error.includes('No Garmin token')) {
          toast({
            title: "Conta não conectada",
            description: "Conecte sua conta Garmin primeiro.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro na sincronização",
            description: errorData.details || errorData.error,
            variant: "destructive",
          });
        }
        return false;
      }

      const result = data as SyncResult;
      setLastSyncResult(result);
      
      toast({
        title: "Sincronização concluída",
        description: `${result.synced} de ${result.total} atividades sincronizadas com sucesso.`,
        variant: "default",
      });

      console.log('[useGarminSync] Manual sync completed:', result);
      return true;

    } catch (error) {
      console.error('[useGarminSync] Unexpected error:', error);
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
