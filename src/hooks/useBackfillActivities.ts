
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BackfillResult {
  success: boolean;
  activities?: {
    found: number;
    saved: number;
    chunksProcessed: number;
    chunksFailed: number;
  };
  activityDetails?: {
    triggered: number;
    failed: number;
    backfillRequestIds: string[];
    message: string;
  };
  message?: string;
  startDate?: string;
  endDate?: string;
}

interface BackfillRequest {
  timeRange: 'last_30_days' | 'custom';
  start?: number;
  end?: number;
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
          description: "Você precisa estar logado para fazer backfill de atividades.",
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
          title: "Erro no backfill",
          description: "Falha ao iniciar o backfill de atividades. Tente novamente.",
          variant: "destructive",
        });
        return false;
      }

      if (data.error) {
        console.error('[useBackfillActivities] API error:', data);
        
        if (data.error.includes('token expired')) {
          toast({
            title: "Token expirado",
            description: "Seu token Garmin expirou. Reconecte sua conta Garmin.",
            variant: "destructive",
          });
        } else if (data.error.includes('No Garmin token')) {
          toast({
            title: "Conta não conectada",
            description: "Conecte sua conta Garmin primeiro.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro no backfill",
            description: data.details || data.error,
            variant: "destructive",
          });
        }
        return false;
      }

      const result = data as BackfillResult;
      setLastBackfillResult(result);
      
      // Show success message based on the results
      const activitiesMsg = result.activities ? 
        `${result.activities.saved} atividades importadas` : 
        'Nenhuma atividade encontrada';
      
      const detailsMsg = result.activityDetails ? 
        `${result.activityDetails.triggered} períodos de detalhes acionados` : 
        'Nenhum detalhe acionado';

      toast({
        title: "Backfill iniciado com sucesso",
        description: `${activitiesMsg}. ${detailsMsg}. Os detalhes chegarão via webhook em alguns minutos.`,
        variant: "default",
      });

      console.log('[useBackfillActivities] Backfill completed:', result);
      return true;

    } catch (error) {
      console.error('[useBackfillActivities] Unexpected error:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado durante o backfill.",
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
