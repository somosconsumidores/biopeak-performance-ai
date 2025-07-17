import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useRecalculateMetrics = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ activityId }: { activityId: string }) => {
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        throw new Error(`Erro de autenticação: ${userError?.message || 'Usuário não encontrado'}`);
      }

      console.log(`🔄 Recalculando métricas para atividade ${activityId}, usuário ${userData.user.id}`);

      // First delete the existing performance metrics
      const { error: deleteError } = await supabase
        .from('performance_metrics')
        .delete()
        .eq('activity_id', activityId)
        .eq('user_id', userData.user.id);

      if (deleteError) {
        console.error('❌ Erro ao deletar métricas existentes:', deleteError);
        throw new Error(`Erro ao deletar métricas existentes: ${deleteError.message}`);
      }

      console.log(`✅ Métricas existentes deletadas para atividade ${activityId}`);

      // Then call the edge function to recalculate
      const { data, error } = await supabase.functions.invoke('calculate-performance-metrics', {
        body: { 
          activity_id: activityId,
          user_id: userData.user.id
        }
      });

      if (error) {
        console.error('❌ Erro ao chamar função de recálculo:', error);
        throw new Error(`Erro ao recalcular métricas: ${error.message}`);
      }

      console.log('✅ Função de recálculo executada com sucesso:', data);
      return data;
    },
    onSuccess: (data, variables) => {
      console.log(`🎉 Métricas recalculadas com sucesso para atividade ${variables.activityId}`);
      
      // Invalidate and refetch performance metrics
      queryClient.invalidateQueries({ 
        queryKey: ['performance-metrics', variables.activityId] 
      });
      
      toast.success("Métricas recalculadas com sucesso!");
    },
    onError: (error) => {
      console.error('❌ Erro no recálculo de métricas:', error);
      toast.error(`Erro ao recalcular métricas: ${error.message}`);
    }
  });
};