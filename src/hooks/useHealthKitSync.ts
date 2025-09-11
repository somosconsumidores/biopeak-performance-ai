import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncResult {
  message: string;
  synced: number;
  total: number;
  lastSyncAt?: Date;
}

interface HealthKitWorkout {
  uuid: string;
  workoutActivityType: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  totalDistance?: number;
  totalEnergyBurned?: number;
  sourceName?: string;
  device?: string;
}

export const useHealthKitSync = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const { toast } = useToast();

  const syncActivities = async (): Promise<boolean> => {
    setIsLoading(true);
    setLastSyncResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para sincronizar atividades.",
          variant: "destructive",
        });
        return false;
      }

      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
        toast({
          title: "Plataforma não suportada",
          description: "Sincronização do HealthKit disponível apenas no iOS.",
          variant: "destructive",
        });
        return false;
      }

      console.log('[useHealthKitSync] Starting HealthKit activities sync...');

      // Check if user has permissions
      const { data: syncStatus } = await supabase
        .from('healthkit_sync_status')
        .select('permissions_granted')
        .eq('user_id', session.user.id)
        .single();

      if (!syncStatus?.permissions_granted) {
        toast({
          title: "Permissões necessárias",
          description: "Configure as permissões do HealthKit primeiro.",
          variant: "destructive",
        });
        return false;
      }

      // Simulate fetching HealthKit workouts
      // In a real implementation, this would use @capacitor-community/health
      const mockWorkouts: HealthKitWorkout[] = [
        {
          uuid: `healthkit_${Date.now()}_1`,
          workoutActivityType: 'Running',
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
          endDate: new Date(Date.now() - 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 min duration
          duration: 1800, // 30 minutes in seconds
          totalDistance: 5000, // 5km in meters
          totalEnergyBurned: 350,
          sourceName: 'Apple Watch',
          device: 'Apple Watch Series 8'
        }
      ];

      // Process and store activities
      let syncedCount = 0;
      
      for (const workout of mockWorkouts) {
        try {
          const activityData = {
            user_id: session.user.id,
            healthkit_uuid: workout.uuid,
            activity_type: workout.workoutActivityType,
            start_time: workout.startDate.toISOString(),
            end_time: workout.endDate.toISOString(),
            duration_seconds: workout.duration,
            distance_meters: workout.totalDistance,
            active_calories: workout.totalEnergyBurned,
            source_name: workout.sourceName,
            device_name: workout.device,
            raw_data: workout
          };

          const { error } = await supabase
            .from('healthkit_activities')
            .upsert(activityData, {
              onConflict: 'user_id, healthkit_uuid'
            });

          if (!error) {
            syncedCount++;
          } else {
            console.error('[useHealthKitSync] Error saving activity:', error);
          }
        } catch (error) {
          console.error('[useHealthKitSync] Error processing workout:', error);
        }
      }

      // Update sync status
      const now = new Date();
      await supabase
        .from('healthkit_sync_status')
        .update({
          sync_status: 'completed',
          last_sync_at: now.toISOString(),
          activities_synced: syncedCount,
          error_message: null
        })
        .eq('user_id', session.user.id);

      const result: SyncResult = {
        message: `Sincronização concluída: ${syncedCount} atividades do HealthKit`,
        synced: syncedCount,
        total: mockWorkouts.length,
        lastSyncAt: now
      };

      setLastSyncResult(result);
      
      toast({
        title: "Sincronização concluída",
        description: result.message,
      });

      console.log('[useHealthKitSync] Sync completed:', result);
      return true;

    } catch (error) {
      console.error('[useHealthKitSync] Unexpected error:', error);
      
      // Update sync status with error
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from('healthkit_sync_status')
          .update({
            sync_status: 'error',
            error_message: error instanceof Error ? error.message : 'Erro desconhecido'
          })
          .eq('user_id', session.user.id);
      }

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
    syncActivities,
    isLoading,
    lastSyncResult,
  };
};