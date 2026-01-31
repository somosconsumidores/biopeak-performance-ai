import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { HealthKit, HealthKitSleepSession } from '@/lib/healthkit';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface SleepSyncResult {
  synced: number;
  errors: number;
}

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
    if (deepPercentage >= 15) {
      qualityAdjustment += 10;
    } else if (deepPercentage >= 10) {
      qualityAdjustment += 5;
    }
    
    // Bonus for good REM sleep (target: 20-25%)
    if (remPercentage >= 20) {
      qualityAdjustment += 10;
    } else if (remPercentage >= 15) {
      qualityAdjustment += 5;
    }
  }
  
  // Penalty for being awake too much
  if (session.inBedSeconds > 0) {
    const awakePercentage = (session.awakeSeconds / session.inBedSeconds) * 100;
    if (awakePercentage > 10) {
      qualityAdjustment -= 10;
    } else if (awakePercentage > 5) {
      qualityAdjustment -= 5;
    }
  }
  
  // Penalty for sleeping less than 6 hours
  if (totalHours < 6) {
    const hoursBelowSix = 6 - totalHours;
    qualityAdjustment -= hoursBelowSix * 5;
  }
  
  // Final score clamped between 0 and 100
  const finalScore = Math.max(0, Math.min(100, baseScore + qualityAdjustment));
  
  return Math.round(finalScore);
};

export const useHealthKitSleepSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SleepSyncResult | null>(null);
  const { user } = useAuth();

  const syncSleepData = useCallback(async (): Promise<SleepSyncResult> => {
    if (!user) {
      console.log('[HealthKitSleepSync] No user logged in');
      return { synced: 0, errors: 0 };
    }

    setIsSyncing(true);
    let synced = 0;
    let errors = 0;

    try {
      console.log('[HealthKitSleepSync] Starting sleep data sync');
      
      // Query sleep data from HealthKit
      const sleepSessions = await HealthKit.querySleepData();
      
      if (sleepSessions.length === 0) {
        console.log('[HealthKitSleepSync] No sleep sessions found');
        setIsSyncing(false);
        return { synced: 0, errors: 0 };
      }

      console.log(`[HealthKitSleepSync] Found ${sleepSessions.length} sleep sessions to sync`);

      // Upsert each session
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

          if (error) {
            console.error(`[HealthKitSleepSync] Error syncing ${session.date}:`, error);
            errors++;
          } else {
            synced++;
          }
        } catch (e) {
          console.error(`[HealthKitSleepSync] Exception syncing ${session.date}:`, e);
          errors++;
        }
      }

      console.log(`[HealthKitSleepSync] Sync complete: ${synced} synced, ${errors} errors`);
      
      const result = { synced, errors };
      setLastSyncResult(result);
      
      if (synced > 0 && errors === 0) {
        toast.success(`${synced} noites de sono sincronizadas`);
      } else if (synced > 0 && errors > 0) {
        toast.warning(`${synced} sincronizadas, ${errors} com erro`);
      }
      
      return result;
    } catch (error) {
      console.error('[HealthKitSleepSync] Sync failed:', error);
      toast.error('Erro ao sincronizar dados de sono');
      return { synced: 0, errors: 1 };
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  return {
    syncSleepData,
    isSyncing,
    lastSyncResult
  };
};
