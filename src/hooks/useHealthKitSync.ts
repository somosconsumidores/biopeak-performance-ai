import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { HealthKit, HealthKitWorkout, HealthKitLocation, HealthKitSeriesData, HealthKitSleepSession } from '@/lib/healthkit';
import { useAuth } from './useAuth';

export interface SyncResult {
  message: string;
  syncedCount: number;
  totalCount: number;
  lastSyncAt: string;
}

export interface ProcessedHealthKitWorkout {
  uuid: string;
  activityType: string;
  startTime: string;
  endTime: string;
  duration: number;
  distance: number;
  energy: number;
  sourceName: string;
  device: string;
  averageHeartRate?: number;
  maxHeartRate?: number;
  locations?: HealthKitLocation[];
  series?: HealthKitSeriesData;
}

export const useHealthKitSync = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const { user } = useAuth();

  const mapWorkoutType = (type: number): string => {
    // HKWorkoutActivityType enum values from Apple HealthKit
    // Reference: developer.apple.com/documentation/healthkit/hkworkoutactivitytype
    const workoutTypes: { [key: number]: string } = {
      // Running types
      37: 'Run',           // HKWorkoutActivityTypeRunning
      
      // Walking types
      52: 'Walk',          // HKWorkoutActivityTypeWalking
      24: 'Hike',          // HKWorkoutActivityTypeHiking
      
      // Cycling types
      13: 'Cycle',         // HKWorkoutActivityTypeCycling
      74: 'Cycle',         // HKWorkoutActivityTypeHandCycling
      
      // Swimming types
      46: 'Swim',          // HKWorkoutActivityTypeSwimming
      
      // Gym/Strength types
      20: 'Strength',      // HKWorkoutActivityTypeFunctionalStrengthTraining
      50: 'Strength',      // HKWorkoutActivityTypeTraditionalStrengthTraining
      
      // Cardio types
      16: 'Elliptical',    // HKWorkoutActivityTypeElliptical
      35: 'Rowing',        // HKWorkoutActivityTypeRowing
      63: 'HIIT',          // HKWorkoutActivityTypeHighIntensityIntervalTraining
      73: 'MixedCardio',   // HKWorkoutActivityTypeMixedCardio
      
      // Cross Training
      11: 'CrossTraining', // HKWorkoutActivityTypeCrossTraining
      
      // Dance
      14: 'Dance',         // HKWorkoutActivityTypeDance
      
      // Yoga/Mind-Body
      27: 'Yoga',          // HKWorkoutActivityTypeMindAndBody
      
      // Other/Default
      3000: 'Other',       // HKWorkoutActivityTypeOther
    };
    return workoutTypes[type] || 'Other';
  };

  /**
   * Calculate a sleep score based on sleep duration and stage quality
   * Since Apple doesn't provide a native sleep score, we calculate one
   */
  const calculateSleepScore = (session: HealthKitSleepSession): number => {
    const totalHours = session.totalSleepSeconds / 3600;
    const totalStageSeconds = session.deepSleepSeconds + session.lightSleepSeconds + session.remSleepSeconds;
    
    // Base score from duration (target: 8 hours = 100%)
    let baseScore = Math.min(100, (totalHours / 8) * 100);
    
    // Quality bonuses/penalties
    let qualityAdjustment = 0;
    
    if (totalStageSeconds > 0) {
      const deepPercentage = (session.deepSleepSeconds / totalStageSeconds) * 100;
      const remPercentage = (session.remSleepSeconds / totalStageSeconds) * 100;
      
      // Bonus for good deep sleep (target: 15-20%)
      if (deepPercentage >= 15) qualityAdjustment += 10;
      else if (deepPercentage >= 10) qualityAdjustment += 5;
      
      // Bonus for good REM sleep (target: 20-25%)
      if (remPercentage >= 20) qualityAdjustment += 10;
      else if (remPercentage >= 15) qualityAdjustment += 5;
    }
    
    // Penalty for being awake too much
    if (session.inBedSeconds > 0) {
      const awakePercentage = (session.awakeSeconds / session.inBedSeconds) * 100;
      if (awakePercentage > 10) qualityAdjustment -= 10;
      else if (awakePercentage > 5) qualityAdjustment -= 5;
    }
    
    // Penalty for sleeping less than 6 hours
    if (totalHours < 6) {
      qualityAdjustment -= (6 - totalHours) * 5;
    }
    
    return Math.round(Math.max(0, Math.min(100, baseScore + qualityAdjustment)));
  };

  const processHeartRateData = (heartRateData?: Array<{timestamp: string; value: number}>): {avg?: number; max?: number} => {
    if (!heartRateData || heartRateData.length === 0) return {};
    
    const values = heartRateData.map(hr => hr.value);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const max = Math.max(...values);
    
    return { avg: Math.round(avg), max: Math.round(max) };
  };

  const syncActivities = async (): Promise<SyncResult> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setIsLoading(true);
    
    try {
      console.log('[HealthKitSync] Starting sync process');
      
      // Check permissions first (including sleep)
      const authResult = await HealthKit.requestAuthorization({
        read: ['workouts', 'heart_rate', 'calories', 'distance', 'steps', 'sleep'],
        write: []
      });

      if (!authResult.granted) {
        toast.error('HealthKit permissions required');
        throw new Error('HealthKit permissions not granted');
      }

      // Query workouts from the last 30 days
      const workouts = await HealthKit.queryWorkouts();
      console.log(`[HealthKitSync] Found ${workouts.length} workouts`);

      if (workouts.length === 0) {
        const result: SyncResult = {
          message: 'No workouts found in HealthKit',
          syncedCount: 0,
          totalCount: 0,
          lastSyncAt: new Date().toISOString()
        };
        setLastSyncResult(result);
        return result;
      }

      const processedWorkouts: ProcessedHealthKitWorkout[] = [];

      // Process each workout
      for (const workout of workouts) {
        try {
          console.log(`[HealthKitSync] Processing workout ${workout.uuid}`);
          
          // Get GPS route if available
          console.log(`[HealthKitSync] Querying GPS route for workout ${workout.uuid}`);
          const locations = await HealthKit.queryWorkoutRoute(workout.uuid);
          console.log(`[HealthKitSync] Found ${locations?.length || 0} GPS points for workout ${workout.uuid}`);
          
          // Get time series data (HR, energy)
          const series = await HealthKit.queryWorkoutSeries(
            workout.uuid,
            workout.startDate,
            workout.endDate
          );

          const heartRateStats = processHeartRateData(series.heartRate);

          const processedWorkout: ProcessedHealthKitWorkout = {
            uuid: workout.uuid,
            activityType: mapWorkoutType(workout.workoutActivityType),
            startTime: workout.startDate,
            endTime: workout.endDate,
            duration: workout.duration,
            distance: workout.totalDistance,
            energy: workout.totalEnergyBurned,
            sourceName: workout.sourceName,
            device: workout.device,
            averageHeartRate: heartRateStats.avg,
            maxHeartRate: heartRateStats.max,
            locations: locations.length > 0 ? locations : undefined,
            series
          };

          processedWorkouts.push(processedWorkout);
        } catch (error) {
          console.error(`[HealthKitSync] Error processing workout ${workout.uuid}:`, error);
        }
      }

      // Save to Supabase using existing table structure
      let syncedCount = 0;
      for (const workout of processedWorkouts) {
        try {
          console.log(`[HealthKitSync] Saving workout ${workout.uuid} with ${workout.locations?.length || 0} GPS points to raw_data`);
          console.log(`[HealthKitSync] Saving workout ${workout.uuid} with ${workout.locations?.length || 0} GPS points to raw_data`);
          
          // Insert into healthkit_activities table (using existing structure)
          const { error: insertError } = await supabase
            .from('healthkit_activities')
            .upsert({
              user_id: user.id,
              healthkit_uuid: workout.uuid, // Using existing column name
              activity_type: workout.activityType,
              start_time: workout.startTime,
              end_time: workout.endTime,
              duration_seconds: Math.round(workout.duration), // Using existing column name
              distance_meters: workout.distance, // Using existing column name
              active_calories: Math.round(workout.energy), // Using existing column name
              average_heart_rate: workout.averageHeartRate, // Using existing column name
              max_heart_rate: workout.maxHeartRate, // Using existing column name
              device_name: workout.device,
              source_name: workout.sourceName,
              activity_date: new Date(workout.startTime).toISOString().split('T')[0],
              raw_data: {
                locations: workout.locations,
                series: workout.series
              }
            }, {
              onConflict: 'user_id,healthkit_uuid'
            });

          if (insertError) {
            console.error('[HealthKitSync] Error inserting workout:', insertError);
            continue;
          }

          // Save GPS coordinates if available
          if (workout.locations && workout.locations.length > 0) {
            console.log(`[HealthKitSync] Saving ${workout.locations.length} GPS coordinates for workout ${workout.uuid}`);
            const coordinates = workout.locations.map(loc => [loc.longitude, loc.latitude]);
            
            const { error: coordError } = await supabase
              .from('activity_coordinates')
              .upsert({
                user_id: user.id,
                activity_id: workout.uuid,
                activity_source: 'healthkit',
                coordinates: coordinates,
                total_points: workout.locations.length,
                sampled_points: workout.locations.length,
                starting_latitude: workout.locations[0].latitude,
                starting_longitude: workout.locations[0].longitude
              }, {
                onConflict: 'user_id,activity_id,activity_source'
              });

            if (coordError) {
              console.error(`[HealthKitSync] Error saving GPS coordinates:`, coordError);
            } else {
              console.log(`[HealthKitSync] Successfully saved GPS coordinates for workout ${workout.uuid}`);
            }
          } else {
            console.log(`[HealthKitSync] No GPS coordinates available for workout ${workout.uuid}`);
          }

          syncedCount++;
        } catch (error) {
          console.error(`[HealthKitSync] Error saving workout ${workout.uuid}:`, error);
        }
      }

      // Update sync status
      await supabase
        .from('healthkit_sync_status')
        .upsert({
          user_id: user.id,
          last_sync_at: new Date().toISOString(),
          sync_status: 'completed',
          activities_synced: syncedCount,
          total_activities: workouts.length,
          error_message: null
        }, {
          onConflict: 'user_id'
        });

      // Also sync sleep data
      let sleepSyncedCount = 0;
      try {
        const sleepSessions = await HealthKit.querySleepData();
        console.log(`[HealthKitSync] Found ${sleepSessions.length} sleep sessions`);
        
        for (const session of sleepSessions) {
          try {
            const sleepScore = calculateSleepScore(session);
            
            const { error } = await supabase
              .from('healthkit_sleep_summaries')
              .upsert({
                user_id: user.id,
                calendar_date: session.date,
                in_bed_seconds: session.inBedSeconds,
                total_sleep_seconds: session.totalSleepSeconds,
                deep_sleep_seconds: session.deepSleepSeconds,
                light_sleep_seconds: session.lightSleepSeconds,
                rem_sleep_seconds: session.remSleepSeconds,
                awake_seconds: session.awakeSeconds,
                sleep_score: sleepScore,
                source_name: 'Apple Watch',
                synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'user_id,calendar_date'
              });

            if (!error) {
              sleepSyncedCount++;
            }
          } catch (e) {
            console.error(`[HealthKitSync] Error syncing sleep ${session.date}:`, e);
          }
        }
        console.log(`[HealthKitSync] Synced ${sleepSyncedCount} sleep sessions`);
      } catch (sleepError) {
        console.error('[HealthKitSync] Error syncing sleep data:', sleepError);
      }

      const result: SyncResult = {
        message: `Synced ${syncedCount} activities${sleepSyncedCount > 0 ? ` and ${sleepSyncedCount} sleep nights` : ''}`,
        syncedCount,
        totalCount: workouts.length,
        lastSyncAt: new Date().toISOString()
      };

      setLastSyncResult(result);
      toast.success(result.message);
      
      return result;

    } catch (error) {
      console.error('[HealthKitSync] Sync failed:', error);
      
      // Update sync status with error
      if (user) {
        await supabase
          .from('healthkit_sync_status')
          .upsert({
            user_id: user.id,
            last_sync_at: new Date().toISOString(),
            sync_status: 'error',
            error_message: error.message
          }, {
            onConflict: 'user_id'
          });
      }

      toast.error(`Sync failed: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    syncActivities,
    isLoading,
    lastSyncResult
  };
};