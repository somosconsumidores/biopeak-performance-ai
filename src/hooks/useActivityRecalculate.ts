import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useActivityRecalculate() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { toast } = useToast();

  const recalculate = async (activityId: string | null, userId: string) => {
    if (!activityId) {
      toast({
        title: 'Erro',
        description: 'ID da atividade não encontrado',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('🔄 Recalculating activity:', activityId);
      
      const { data, error } = await supabase.functions.invoke('recalculate-gpx-activity', {
        body: {
          activity_id: activityId,
          user_id: userId,
        },
      });

      if (error) {
        console.error('❌ Recalculate error:', error);
        throw error;
      }

      console.log('✅ Recalculate success:', data);
      
      toast({
        title: 'Análise recalculada!',
        description: 'Os dados da atividade foram reprocessados com sucesso.',
      });

      // Trigger refresh
      setRefreshTrigger(prev => prev + 1);
      
    } catch (error: any) {
      console.error('❌ Error recalculating activity:', error);
      toast({
        title: 'Erro ao recalcular',
        description: error.message || 'Não foi possível recalcular a análise da atividade.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    recalculate,
    isProcessing,
    refreshTrigger,
  };
}
