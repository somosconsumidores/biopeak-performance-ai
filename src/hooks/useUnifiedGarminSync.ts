import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UnifiedSyncStage {
  name: 'activities' | 'details';
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: number;
  message?: string;
}

interface UnifiedSyncResult {
  activities: {
    message: string;
    synced: number;
    total: number;
  };
  details: {
    message: string;
    synced: number;
    total: number;
    errors?: string[];
  };
  totalDuration: number;
}

export const useUnifiedGarminSync = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<UnifiedSyncStage>({ name: 'activities', status: 'pending' });
  const [stages, setStages] = useState<UnifiedSyncStage[]>([
    { name: 'activities', status: 'pending', message: 'Aguardando...' },
    { name: 'details', status: 'pending', message: 'Aguardando...' }
  ]);
  const [lastSyncResult, setLastSyncResult] = useState<UnifiedSyncResult | null>(null);
  const { toast } = useToast();

  const updateStage = (stageName: 'activities' | 'details', updates: Partial<UnifiedSyncStage>) => {
    setStages(prev => prev.map(stage => 
      stage.name === stageName ? { ...stage, ...updates } : stage
    ));
    if (updates.status === 'running') {
      setCurrentStage({ name: stageName, status: 'running', ...updates });
    }
  };

  const syncUnified = async (): Promise<boolean> => {
    const startTime = Date.now();
    setIsLoading(true);
    setLastSyncResult(null);

    // Reset stages
    setStages([
      { name: 'activities', status: 'pending', message: 'Aguardando...' },
      { name: 'details', status: 'pending', message: 'Aguardando...' }
    ]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para sincronizar.",
          variant: "destructive",
        });
        return false;
      }

      // ETAPA 1: Sincronizar atividades básicas
      console.log('[useUnifiedGarminSync] Starting activities sync...');
      updateStage('activities', { 
        status: 'running', 
        progress: 0, 
        message: 'Sincronizando atividades básicas...' 
      });

      const { data: activitiesData, error: activitiesError } = await supabase.functions.invoke('sync-garmin-activities', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (activitiesError || activitiesData?.error) {
        updateStage('activities', { 
          status: 'error', 
          message: 'Erro ao sincronizar atividades' 
        });
        
        const errorMsg = activitiesData?.error || activitiesError.message;
        console.error('[useUnifiedGarminSync] Activities sync error:', errorMsg);
        
        toast({
          title: "Erro na sincronização",
          description: "Falha ao sincronizar atividades básicas.",
          variant: "destructive",
        });
        return false;
      }

      const activitiesResult = activitiesData;
      updateStage('activities', { 
        status: 'completed', 
        progress: 100, 
        message: `${activitiesResult.synced} atividades sincronizadas` 
      });

      // ETAPA 2: Sincronizar detalhes das atividades recentes (últimas 24h)
      console.log('[useUnifiedGarminSync] Starting activity details sync...');
      updateStage('details', { 
        status: 'running', 
        progress: 0, 
        message: 'Sincronizando detalhes das atividades recentes...' 
      });

      // Calcular timestamp para últimas 24 horas
      const now = Date.now();
      const oneDayAgo = Math.floor((now - (24 * 60 * 60 * 1000)) / 1000);

      const { data: detailsData, error: detailsError } = await supabase.functions.invoke('sync-garmin-activity-details', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          uploadStartTimeInSeconds: oneDayAgo
        }
      });

      if (detailsError || detailsData?.error) {
        updateStage('details', { 
          status: 'error', 
          message: 'Erro ao sincronizar detalhes (atividades básicas sincronizadas com sucesso)' 
        });
        
        console.warn('[useUnifiedGarminSync] Details sync failed, but activities succeeded');
        
        // Não falha o processo completo se apenas os detalhes falharam
        toast({
          title: "Sincronização parcial",
          description: `${activitiesResult.synced} atividades sincronizadas. Detalhes das atividades recentes não foram sincronizados.`,
          variant: "default",
        });
      } else {
        const detailsResult = detailsData;
        updateStage('details', { 
          status: 'completed', 
          progress: 100, 
          message: `${detailsResult.synced} detalhes sincronizados` 
        });

        toast({
          title: "Sincronização completa",
          description: `${activitiesResult.synced} atividades e ${detailsResult.synced} detalhes sincronizados com sucesso.`,
          variant: "default",
        });
      }

      // Armazenar resultado completo
      const totalDuration = Date.now() - startTime;
      const finalResult: UnifiedSyncResult = {
        activities: activitiesResult,
        details: detailsData || { message: 'Falha', synced: 0, total: 0 },
        totalDuration
      };
      
      setLastSyncResult(finalResult);
      console.log('[useUnifiedGarminSync] Unified sync completed:', finalResult);
      
      return true;

    } catch (error) {
      console.error('[useUnifiedGarminSync] Unexpected error:', error);
      
      // Atualizar estágio atual como erro
      updateStage(currentStage.name, { 
        status: 'error', 
        message: 'Erro inesperado' 
      });
      
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
    syncUnified,
    isLoading,
    currentStage,
    stages,
    lastSyncResult,
  };
};