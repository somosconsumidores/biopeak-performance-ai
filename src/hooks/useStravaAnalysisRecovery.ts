import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface StravaAnalysisRecoveryResult {
  success: boolean;
  processed_points?: number;
  activity_id?: string;
  message?: string;
  error?: string;
}

interface UseStravaAnalysisRecoveryReturn {
  triggerAnalysis: (activityId: string) => Promise<void>;
  isProcessing: boolean;
  error: string | null;
  lastProcessedActivity: string | null;
}

export const useStravaAnalysisRecovery = (): UseStravaAnalysisRecoveryReturn => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastProcessedActivity, setLastProcessedActivity] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const triggerAnalysis = async (activityId: string): Promise<void> => {
    if (isProcessing) {
      toast({
        title: "Processamento em andamento",
        description: "Aguarde o processamento atual terminar",
        variant: "default"
      });
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      console.log('🔄 Starting Strava analysis recovery for activity:', activityId);

      toast({
        title: "Iniciando análise",
        description: "Recuperando dados da atividade do Strava...",
      });

      const { data, error: functionError } = await supabase.functions.invoke(
        'strava-activity-streams-on-demand',
        {
          body: { activity_id: activityId }
        }
      );

      if (functionError) {
        console.error('❌ Function error:', functionError);
        throw new Error(functionError.message || 'Erro ao chamar função de recuperação');
      }

      if (!data || !data.success) {
        console.error('❌ Function returned error:', data);
        throw new Error(data?.error || 'Erro desconhecido na recuperação');
      }

      const result = data as StravaAnalysisRecoveryResult;
      console.log('✅ Analysis recovery successful:', result);

      setLastProcessedActivity(activityId);

      toast({
        title: "Análise recuperada com sucesso!",
        description: `Processados ${result.processed_points || 0} pontos de dados. Atualizando visualizações...`,
      });

      // Invalidate relevant queries to refresh the UI
      await queryClient.invalidateQueries({ 
        queryKey: ['activity-chart', activityId] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['activity-pace-data', activityId] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['activity-coordinates', activityId] 
      });

      // Small delay to ensure data propagation
      setTimeout(() => {
        toast({
          title: "Visualizações atualizadas",
          description: "A análise da atividade está pronta!",
        });
      }, 2000);

    } catch (err) {
      console.error('❌ Error in triggerAnalysis:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      
      toast({
        title: "Erro na recuperação",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    triggerAnalysis,
    isProcessing,
    error,
    lastProcessedActivity
  };
};