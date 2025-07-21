
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BackfillRequest {
  timeRange: 'last_30_days' | 'custom';
  start?: number;
  end?: number;
}

interface BackfillResult {
  success: boolean;
  activities: number;
  timeRange: string;
  startDate: string;
  endDate: string;
  activitiesFound: number;
  activitiesSaved: number;
  chunksProcessed: number;
  chunksFailed: number;
}

interface BackfillError {
  error: string;
  details?: string;
}

export const useBackfillActivities = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastBackfillResult, setLastBackfillResult] = useState<BackfillResult | null>(null);
  const { toast } = useToast();

  const backfillActivities = async (request: BackfillRequest): Promise<boolean> => {
    setIsLoading(true);
    setLastBackfillResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para buscar atividades.",
          variant: "destructive",
        });
        return false;
      }

      console.log('[useBackfillActivities] Starting backfill request:', request);
      
      const { data, error } = await supabase.functions.invoke('backfill-activities', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: request
      });

      if (error) {
        console.error('[useBackfillActivities] Function error:', error);
        toast({
          title: "Erro na busca",
          description: "Falha ao buscar atividades históricas. Tente novamente.",
          variant: "destructive",
        });
        return false;
      }

      if (data.error) {
        const errorData = data as BackfillError;
        console.error('[useBackfillActivities] API error:', errorData);
        
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
            title: "Erro na busca",
            description: errorData.details || errorData.error,
            variant: "destructive",
          });
        }
        return false;
      }

      const result = data as BackfillResult;
      setLastBackfillResult(result);
      
      const timeRangeText = result.timeRange === 'last_30_days' ? 'últimos 30 dias' : 'período personalizado';
      const chunkInfo = result.chunksFailed > 0 ? ` (${result.chunksFailed} períodos falharam)` : '';
      
      toast({
        title: "Busca concluída",
        description: `${result.activitiesSaved} atividades encontradas para ${timeRangeText}${chunkInfo}.`,
        variant: "default",
      });

      console.log('[useBackfillActivities] Backfill completed:', result);
      return true;

    } catch (error) {
      console.error('[useBackfillActivities] Unexpected error:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado durante a busca.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    backfillActivities,
    isLoading,
    lastBackfillResult,
  };
};
