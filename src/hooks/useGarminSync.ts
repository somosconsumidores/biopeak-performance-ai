
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

      console.log('[useGarminSync] Manual sync disabled to prevent unprompted pull notifications');
      
      toast({
        title: "Sincronização manual desabilitada",
        description: "Use apenas sincronização automática via webhooks para evitar notificações não solicitadas da Garmin.",
        variant: "destructive",
      });

      return false;

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
