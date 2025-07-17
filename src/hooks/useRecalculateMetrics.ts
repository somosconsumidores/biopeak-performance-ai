import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useRecalculateMetrics = () => {
  return useMutation({
    mutationFn: async ({ activityId }: { activityId: string }) => {
      // First delete the existing performance metrics
      const { error: deleteError } = await supabase
        .from('performance_metrics')
        .delete()
        .eq('activity_id', activityId);

      if (deleteError) {
        throw new Error(`Error deleting existing metrics: ${deleteError.message}`);
      }

      // Then call the edge function to recalculate
      const { data, error } = await supabase.functions.invoke('calculate-performance-metrics', {
        body: { 
          activity_id: activityId,
          user_id: (await supabase.auth.getUser()).data.user?.id
        }
      });

      if (error) {
        throw new Error(`Error recalculating metrics: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Métricas recalculadas com sucesso!");
    },
    onError: (error) => {
      console.error('Error recalculating metrics:', error);
      toast.error(`Erro ao recalcular métricas: ${error.message}`);
    }
  });
};