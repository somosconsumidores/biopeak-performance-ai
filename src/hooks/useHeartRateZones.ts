import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HeartRateZone {
  zone: string;
  label: string;
  minHR: number;
  maxHR: number;
  percentage: number;
  timeInZone: number;
  color: string;
}

export const useHeartRateZones = (activityId: string | null, userMaxHR?: number) => {
  const [zones, setZones] = useState<HeartRateZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateZones = async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 ZONES: Calculating zones for activity ID:', id);
      
      // Query to count seconds (rows) spent in each heart rate zone
      const { data: activityDetails, error } = await supabase
        .from('garmin_activity_details')
        .select('heart_rate')
        .eq('activity_id', id)
        .not('heart_rate', 'is', null)
        .order('sample_timestamp', { ascending: true });

      if (error) throw error;
      
      console.log('🔍 ZONES: Total HR records (seconds):', activityDetails?.length);

      if (!activityDetails || activityDetails.length === 0) {
        setZones([]);
        return;
      }

      // Calculate max HR from data or use provided
      const dataMaxHR = Math.max(...activityDetails.map(d => d.heart_rate));
      const maxHR = userMaxHR || dataMaxHR;
      
      console.log('🔍 ZONES: Max HR used for zones:', maxHR);

      // Define heart rate zones based on % of max HR
      const zoneDefinitions = [
        { zone: 'Zona 1', label: 'Recuperação', minPercent: 50, maxPercent: 60, color: 'bg-blue-500' },
        { zone: 'Zona 2', label: 'Aeróbica', minPercent: 60, maxPercent: 70, color: 'bg-green-500' },
        { zone: 'Zona 3', label: 'Limiar', minPercent: 70, maxPercent: 80, color: 'bg-yellow-500' },
        { zone: 'Zona 4', label: 'Anaeróbica', minPercent: 80, maxPercent: 90, color: 'bg-orange-500' },
        { zone: 'Zona 5', label: 'Máxima', minPercent: 90, maxPercent: 100, color: 'bg-red-500' }
      ];

      // Count seconds (rows) in each zone
      const totalSeconds = activityDetails.length;
      const calculatedZones: HeartRateZone[] = zoneDefinitions.map(zoneDef => {
        const minHR = Math.round((zoneDef.minPercent / 100) * maxHR);
        const maxHR_zone = Math.round((zoneDef.maxPercent / 100) * maxHR);
        
        // Count how many seconds (rows) fall within this zone
        const secondsInZone = activityDetails.filter(record => {
          const hr = record.heart_rate;
          return hr >= minHR && hr < maxHR_zone;
        }).length;

        const percentage = totalSeconds > 0 ? Math.round((secondsInZone / totalSeconds) * 100) : 0;

        return {
          zone: zoneDef.zone,
          label: zoneDef.label,
          minHR,
          maxHR: maxHR_zone,
          percentage,
          timeInZone: secondsInZone, // Each record = 1 second
          color: zoneDef.color
        };
      });

      console.log('🔍 ZONES: Zone distribution:', calculatedZones.map(z => ({
        zone: z.zone,
        range: `${z.minHR}-${z.maxHR} bpm`,
        seconds: z.timeInZone,
        percentage: z.percentage + '%'
      })));

      setZones(calculatedZones);
    } catch (err) {
      console.error('Error calculating heart rate zones:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔍 ZONES: useEffect triggered with activityId:', activityId);
    if (activityId) {
      console.log('🔍 ZONES: Starting calculation for activity:', activityId);
      calculateZones(activityId);
    } else {
      console.log('🔍 ZONES: No activityId provided, clearing zones');
      setZones([]);
      setError(null);
    }
  }, [activityId, userMaxHR]);

  return {
    zones,
    loading,
    error,
    hasData: zones.length > 0
  };
};