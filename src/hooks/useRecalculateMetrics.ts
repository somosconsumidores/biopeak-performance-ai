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

      // Also delete variation analysis cache
      const { error: deleteCacheError } = await supabase
        .from('variation_analysis_cache' as any)
        .delete()
        .eq('activity_id', activityId)
        .eq('user_id', userData.user.id);

      if (deleteCacheError) {
        console.error('⚠️ Erro ao deletar cache de análise de variação:', deleteCacheError);
        // Don't throw here, just log the error
      }

      console.log(`✅ Métricas e cache existentes deletados para atividade ${activityId}`);

      // Check if this is a Strava, Polar or Garmin activity
      const { data: stravaActivity } = await supabase
        .from('strava_activities')
        .select('strava_activity_id')
        .eq('id', activityId)
        .maybeSingle();

      const { data: polarActivity } = await supabase
        .from('polar_activities')
        .select('activity_id')
        .eq('id', activityId)
        .maybeSingle();

      // Then call the appropriate edge function to recalculate
      let functionName = 'calculate-performance-metrics';
      let activityIdToUse = activityId;
      let activitySource = 'GARMIN'; // Default
      
      if (stravaActivity) {
        functionName = 'calculate-strava-performance-metrics';
        activityIdToUse = activityId; // Use UUID for consistency
        activitySource = 'STRAVA';
      } else if (polarActivity) {
        functionName = 'calculate-polar-performance-metrics';
        activityIdToUse = activityId; // Use UUID for consistency
        activitySource = 'POLAR';
      }
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { 
          activity_id: activityIdToUse,
          user_id: userData.user.id
        }
      });

      if (error) {
        console.error('❌ Erro ao chamar função de recálculo:', error);
        throw new Error(`Erro ao recalcular métricas: ${error.message}`);
      }

      console.log('✅ Função de recálculo executada com sucesso:', data);

      // Also recalculate variation analysis
      try {
        const { error: variationError } = await supabase.functions.invoke('calculate-variation-analysis', {
          body: {
            activityId: activityIdToUse,
            activitySource,
            userId: userData.user.id
          }
        });

        if (variationError) {
          console.error('⚠️ Erro ao recalcular análise de variação:', variationError);
          // Don't throw here, just log the error
        } else {
          console.log('✅ Análise de variação recalculada com sucesso');
        }
      } catch (variationErr) {
        console.error('⚠️ Erro ao recalcular análise de variação:', variationErr);
        // Don't throw here, just log the error
      }

      return data;
    },
    onSuccess: (data, variables) => {
      console.log(`🎉 Métricas recalculadas com sucesso para atividade ${variables.activityId}`);
      
      // Invalidate and refetch performance metrics and variation analysis
      queryClient.invalidateQueries({ 
        queryKey: ['performance-metrics', variables.activityId] 
      });
      
      // Also invalidate variation analysis cache
      queryClient.invalidateQueries({ 
        queryKey: ['variation-analysis', variables.activityId] 
      });
      
      toast.success("Métricas recalculadas com sucesso!");
    },
    onError: (error) => {
      console.error('❌ Erro no recálculo de métricas:', error);
      toast.error(`Erro ao recalcular métricas: ${error.message}`);
    }
  });
};