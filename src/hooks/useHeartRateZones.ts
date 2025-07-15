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
      
      // Get all heart rate data for the activity
      const allHRData = [];
      const chunkSize = 1000;
      let currentOffset = 0;
      
      // First get count
      const { count, error: countError } = await supabase
        .from('garmin_activity_details')
        .select('*', { count: 'exact', head: true })
        .eq('activity_id', id)
        .not('heart_rate', 'is', null);

      if (countError) throw countError;
      console.log('🔍 ZONES: Total HR records:', count);

      // Fetch all data in chunks
      while (currentOffset < (count || 0)) {
        const { data: chunk, error: chunkError } = await supabase
          .from('garmin_activity_details')
          .select('heart_rate, sample_timestamp')
          .eq('activity_id', id)
          .not('heart_rate', 'is', null)
          .order('sample_timestamp', { ascending: true })
          .range(currentOffset, currentOffset + chunkSize - 1);

        if (chunkError) throw chunkError;
        
        if (chunk && chunk.length > 0) {
          allHRData.push(...chunk);
        }
        
        currentOffset += chunkSize;
        if (!chunk || chunk.length < chunkSize) break;
      }

      console.log('🔍 ZONES: Total HR data points fetched:', allHRData.length);

      if (allHRData.length === 0) {
        setZones([]);
        return;
      }

      // Calculate max HR from data or use provided
      const dataMaxHR = Math.max(...allHRData.map(d => d.heart_rate || 0));
      const maxHR = userMaxHR || dataMaxHR;
      
      console.log('🔍 ZONES: Max HR used for zones:', maxHR, '(user provided:', userMaxHR, ', data max:', dataMaxHR, ')');

      // Define heart rate zones based on % of max HR
      const zoneDefinitions = [
        { zone: 'Zona 1', label: 'Recuperação', minPercent: 50, maxPercent: 60, color: 'bg-blue-500' },
        { zone: 'Zona 2', label: 'Aeróbica', minPercent: 60, maxPercent: 70, color: 'bg-green-500' },
        { zone: 'Zona 3', label: 'Limiar', minPercent: 70, maxPercent: 80, color: 'bg-yellow-500' },
        { zone: 'Zona 4', label: 'Anaeróbica', minPercent: 80, maxPercent: 90, color: 'bg-orange-500' },
        { zone: 'Zona 5', label: 'Máxima', minPercent: 90, maxPercent: 100, color: 'bg-red-500' }
      ];

      // Calculate time in each zone
      const zoneCounts = zoneDefinitions.map(zoneDef => {
        const minHR = Math.round((zoneDef.minPercent / 100) * maxHR);
        const maxHR_zone = Math.round((zoneDef.maxPercent / 100) * maxHR);
        
        const recordsInZone = allHRData.filter(record => {
          const hr = record.heart_rate || 0;
          return hr >= minHR && hr < maxHR_zone;
        });

        return {
          ...zoneDef,
          minHR,
          maxHR: maxHR_zone,
          count: recordsInZone.length,
          timeInZone: recordsInZone.length // Each record represents ~1 second
        };
      });

      // Calculate percentages
      const totalRecords = allHRData.length;
      const calculatedZones: HeartRateZone[] = zoneCounts.map(zone => ({
        zone: zone.zone,
        label: zone.label,
        minHR: zone.minHR,
        maxHR: zone.maxHR,
        percentage: totalRecords > 0 ? Math.round((zone.count / totalRecords) * 100) : 0,
        timeInZone: zone.timeInZone,
        color: zone.color
      }));

      console.log('🔍 ZONES: Calculated zones:', calculatedZones.map(z => ({
        zone: z.zone,
        range: `${z.minHR}-${z.maxHR}`,
        percentage: z.percentage,
        timeInSeconds: z.timeInZone
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
    if (activityId) {
      calculateZones(activityId);
    } else {
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