
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WebhookSyncStats {
  lastWebhookSync: string | null;
  activitiesCount: number;
  webhookStatus: 'active' | 'inactive' | 'unknown';
  lastSyncMethod: string; // Changed to accept any string value
}

export const useWebhookOnlyGarminSync = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<WebhookSyncStats>({
    lastWebhookSync: null,
    activitiesCount: 0,
    webhookStatus: 'unknown',
    lastSyncMethod: 'unknown'
  });
  const { toast } = useToast();

  // Admin-only emergency sync function
  const emergencySync = async (confirmationCode: string): Promise<boolean> => {
    if (confirmationCode !== 'EMERGENCY_SYNC_CONFIRMED') {
      toast({
        title: "Código de confirmação inválido",
        description: "Digite 'EMERGENCY_SYNC_CONFIRMED' para confirmar a sincronização de emergência.",
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para executar sincronização de emergência.",
          variant: "destructive",
        });
        return false;
      }

      console.log('[useWebhookOnlyGarminSync] Starting emergency admin override sync...');
      
      // Call activities sync with admin override
      const { data: activitiesData, error: activitiesError } = await supabase.functions.invoke('sync-garmin-activities', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          admin_override: true,
          webhook_triggered: false
        }
      });

      if (activitiesError || activitiesData?.error) {
        console.error('[useWebhookOnlyGarminSync] Emergency sync failed:', activitiesError || activitiesData?.error);
        toast({
          title: "Falha na sincronização de emergência",
          description: "Não foi possível executar a sincronização. Verifique se os webhooks estão configurados corretamente.",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Sincronização de emergência concluída",
        description: `${activitiesData.synced} atividades sincronizadas via override administrativo.`,
        variant: "default",
      });

      console.log('[useWebhookOnlyGarminSync] Emergency sync completed:', activitiesData);
      await fetchStats(); // Update stats after sync
      return true;

    } catch (error) {
      console.error('[useWebhookOnlyGarminSync] Unexpected error:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado durante a sincronização de emergência.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch webhook sync statistics
  const fetchStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get latest sync info
      const { data: syncData } = await supabase
        .from('garmin_sync_control')
        .select('*')
        .eq('user_id', session.user.id)
        .order('last_sync_at', { ascending: false })
        .limit(1)
        .single();

      // Get activities count
      const { count: activitiesCount } = await supabase
        .from('garmin_activities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id);

      // Get latest webhook logs
      const { data: webhookLogs } = await supabase
        .from('garmin_webhook_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      setStats({
        lastWebhookSync: syncData?.last_sync_at || null,
        activitiesCount: activitiesCount || 0,
        webhookStatus: webhookLogs && webhookLogs.length > 0 ? 'active' : 'inactive',
        lastSyncMethod: syncData?.triggered_by || 'unknown'
      });

    } catch (error) {
      console.error('[useWebhookOnlyGarminSync] Error fetching stats:', error);
    }
  };

  // Function to reprocess stuck webhooks
  const reprocessStuckWebhooks = async (): Promise<boolean> => {
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para reprocessar webhooks.",
          variant: "destructive",
        });
        return false;
      }

      console.log('[useWebhookOnlyGarminSync] Starting stuck webhooks reprocessing...');
      
      // Call the reprocess stuck webhooks function
      const { data: reprocessData, error: reprocessError } = await supabase.functions.invoke('reprocess-stuck-webhooks', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });

      if (reprocessError || reprocessData?.error) {
        console.error('[useWebhookOnlyGarminSync] Reprocess failed:', reprocessError || reprocessData?.error);
        toast({
          title: "Falha no reprocessamento",
          description: "Não foi possível reprocessar os webhooks travados.",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Reprocessamento concluído",
        description: `${reprocessData.reprocessed} webhooks reprocessados, ${reprocessData.failed} falharam.`,
        variant: "default",
      });

      console.log('[useWebhookOnlyGarminSync] Reprocessing completed:', reprocessData);
      await fetchStats(); // Update stats after reprocessing
      return true;

    } catch (error) {
      console.error('[useWebhookOnlyGarminSync] Unexpected error:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado durante o reprocessamento.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    emergencySync,
    reprocessStuckWebhooks,
    fetchStats,
    stats,
    isLoading,
  };
};
