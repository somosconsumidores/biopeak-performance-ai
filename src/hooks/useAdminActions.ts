import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useAdminActions = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const renewExpiredTokens = async (userId?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('direct-token-renewal', {
        body: userId ? { user_id: userId } : {}
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Renovação de Tokens",
        description: `Processo de renovação concluído: ${data?.summary || 'Verificar logs para detalhes'}`,
      });

      return data;
    } catch (error) {
      console.error('Error renewing tokens:', error);
      toast({
        title: "Erro na Renovação",
        description: "Falha ao renovar tokens expirados",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const backfillActivityCharts = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-activity-charts-from-logs', {
        body: { user_id: userId }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Backfill de Activity Charts",
        description: `Processamento concluído: ${data?.processed || 0} logs processados, ${data?.success || 0} sucessos, ${data?.errors || 0} erros`,
      });

      return data;
    } catch (error) {
      console.error('Error in backfill activity charts:', error);
      toast({
        title: "Erro no Backfill",
        description: "Falha ao processar logs de atividades",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const reclassifyUnclassifiedWorkouts = async () => {
    toast({
      title: "Reclassificação desativada",
      description: "Esta ação foi descontinuada para evitar alto consumo de IO.",
    });
    return { success: false, disabled: true } as const;
  };

  return {
    renewExpiredTokens,
    backfillActivityCharts,
    reclassifyUnclassifiedWorkouts,
    loading
  };
};