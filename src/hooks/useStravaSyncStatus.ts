import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SyncJob {
  id: string;
  user_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  activities_synced: number;
  total_activities: number;
  error_message?: string;
}

export const useStravaSyncStatus = () => {
  const [currentJob, setCurrentJob] = useState<SyncJob | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('🔵 [useStravaSyncStatus] Setting up Realtime listener...');

    const channel = supabase
      .channel('strava-sync-jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'strava_sync_jobs',
        },
        (payload) => {
          console.log('🔔 [useStravaSyncStatus] Realtime update:', payload);
          
          const job = payload.new as SyncJob;
          setCurrentJob(job);

          if (job.status === 'completed') {
            toast({
              title: "Sincronização concluída!",
              description: `${job.activities_synced} atividades sincronizadas com sucesso`,
            });

            // Invalidate queries to update UI
            queryClient.invalidateQueries({ queryKey: ['strava-stats'] });
            queryClient.invalidateQueries({ queryKey: ['strava-activities'] });
            queryClient.invalidateQueries({ queryKey: ['all-activities'] });
          } else if (job.status === 'failed') {
            toast({
              title: "Erro na sincronização",
              description: job.error_message || "Falha ao sincronizar atividades",
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔵 [useStravaSyncStatus] Cleaning up Realtime listener');
      supabase.removeChannel(channel);
    };
  }, [toast, queryClient]);

  return { currentJob };
};
