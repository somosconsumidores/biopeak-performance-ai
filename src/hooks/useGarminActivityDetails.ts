import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ActivityDetailsSyncResult {
  message: string;
  synced: number;
  total: number;
  errors?: string[];
}

interface ActivityDetailsSyncError {
  error: string;
  details?: string;
}

export const useGarminActivityDetails = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<ActivityDetailsSyncResult | null>(null);
  const { toast } = useToast();

  const syncActivityDetails = async (timeRange?: {
    uploadStartTimeInSeconds?: number;
    uploadEndTimeInSeconds?: number;
  }): Promise<boolean> => {
    setIsLoading(true);
    setLastSyncResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para sincronizar detalhes das atividades.",
          variant: "destructive",
        });
        return false;
      }

      console.log('[useGarminActivityDetails] Starting activity details sync...');
      
      const { data, error } = await supabase.functions.invoke('sync-garmin-activity-details', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { admin_override: true, ...(timeRange || {}) }
      });

      if (error) {
        console.error('[useGarminActivityDetails] Function error:', error);
        toast({
          title: "Erro na sincronização",
          description: "Falha ao sincronizar detalhes das atividades. Tente novamente.",
          variant: "destructive",
        });
        return false;
      }

      if (data.error) {
        const errorData = data as ActivityDetailsSyncError;
        console.error('[useGarminActivityDetails] API error:', errorData);
        
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

      const result = data as ActivityDetailsSyncResult;
      setLastSyncResult(result);
      
      toast({
        title: "Sincronização concluída",
        description: `${result.synced} de ${result.total} detalhes de atividades sincronizados com sucesso.`,
        variant: "default",
      });

      if (result.errors && result.errors.length > 0) {
        console.warn('[useGarminActivityDetails] Sync completed with errors:', result.errors);
      }

      console.log('[useGarminActivityDetails] Sync completed:', result);
      return true;

    } catch (error) {
      console.error('[useGarminActivityDetails] Unexpected error:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado durante a sincronização dos detalhes.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivityDetails = async (summaryId: string) => {
    try {
      const { data, error } = await supabase
        .from('garmin_activity_details')
        .select('*')
        .eq('summary_id', summaryId)
        .single();

      if (error) {
        console.error('[useGarminActivityDetails] Error fetching activity details:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[useGarminActivityDetails] Unexpected error fetching activity details:', error);
      return null;
    }
  };

  const fetchUserActivityDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('garmin_activity_details')
        .select('*')
        .order('upload_time_in_seconds', { ascending: false });

      if (error) {
        console.error('[useGarminActivityDetails] Error fetching user activity details:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[useGarminActivityDetails] Unexpected error fetching user activity details:', error);
      return [];
    }
  };

  return {
    syncActivityDetails,
    fetchActivityDetails,
    fetchUserActivityDetails,
    isLoading,
    lastSyncResult,
  };
};