import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Health } from '../types/healthkit';
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
  averageHeartRate?: number;
  maxHeartRate?: number;
}

export const useHealthKitSync = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const { toast } = useToast();

  // Helper function to map HealthKit workout types
  const mapWorkoutType = (hkType: number): string => {
    const typeMap: { [key: number]: string } = {
      1: 'Running', // HKWorkoutActivityTypeRunning
      2: 'Walking', // HKWorkoutActivityTypeWalking  
      13: 'Cycling', // HKWorkoutActivityTypeCycling
      16: 'Swimming', // HKWorkoutActivityTypeSwimming
      3000: 'Other' // HKWorkoutActivityTypeOther
    };
    return typeMap[hkType] || 'Other';
  };

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

      // Fetch workouts from HealthKit
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30); // Last 30 days

      const workouts = await Health.queryHKitSampleType({
        sampleName: 'HKWorkoutTypeIdentifier',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 100
      });

      // Fetch additional data for each workout
      const processedWorkouts: HealthKitWorkout[] = [];
      
      for (const workout of workouts.resultData || []) {
        try {
          // Fetch heart rate data for this workout
          const heartRateData = await Health.queryHKitSampleType({
            sampleName: 'HKQuantityTypeIdentifierHeartRate',
            startDate: workout.startDate,
            endDate: workout.endDate,
            limit: 1000
          });

          // Calculate average and max heart rate
          const heartRates = heartRateData.resultData?.map(hr => parseFloat(hr.value)) || [];
          const avgHeartRate = heartRates.length > 0 ? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length) : undefined;
          const maxHeartRate = heartRates.length > 0 ? Math.max(...heartRates) : undefined;

          const processedWorkout: HealthKitWorkout = {
            uuid: workout.uuid,
            workoutActivityType: mapWorkoutType(workout.workoutActivityType || 1),
            startDate: new Date(workout.startDate),
            endDate: new Date(workout.endDate),
            duration: workout.duration || 0,
            totalDistance: workout.totalDistance,
            totalEnergyBurned: workout.totalEnergyBurned,
            sourceName: workout.sourceName || 'Apple Watch',
            device: workout.device || 'Apple Watch',
            averageHeartRate: avgHeartRate,
            maxHeartRate: maxHeartRate
          };

          processedWorkouts.push(processedWorkout);
        } catch (error) {
          console.error('[useHealthKitSync] Error processing workout:', error);
        }
      }

      // Process and store activities
      let syncedCount = 0;
      
      for (const workout of processedWorkouts) {
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
            average_heart_rate: workout.averageHeartRate,
            max_heart_rate: workout.maxHeartRate,
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
        total: processedWorkouts.length,
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