import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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
  const { user } = useAuth();

  const calculateZones = async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 ZONES: Calculating zones for activity ID:', id, 'User ID:', user?.id);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Query filtering by BOTH user_id AND activity_id
      const { data: activityDetails, error } = await supabase
        .from('garmin_activity_details')
        .select('heart_rate')
        .eq('user_id', user.id)
        .eq('activity_id', id)
        .order('sample_timestamp', { ascending: true });

      if (error) throw error;
      
      console.log('🔍 ZONES: Raw query results:', {
        totalRecords: activityDetails?.length || 0,
        sampleData: activityDetails?.slice(0, 5)
      });

      if (!activityDetails || activityDetails.length === 0) {
        setZones([]);
        return;
      }

      // Filter out null heart rates and check what we're losing
      const validHRRecords = activityDetails.filter(d => d.heart_rate !== null);
      const nullHRCount = activityDetails.length - validHRRecords.length;
      
      console.log('🔍 ZONES: HR Data Analysis:', {
        totalRecords: activityDetails.length,
        validHRRecords: validHRRecords.length,
        nullHRRecords: nullHRCount,
        nullPercentage: Math.round((nullHRCount / activityDetails.length) * 100) + '%'
      });

      if (validHRRecords.length === 0) {
        setZones([]);
        return;
      }

      // Get user's profile to calculate theoretical max HR
      const { data: profile } = await supabase
        .from('profiles')
        .select('birth_date')
        .eq('user_id', user.id)
        .single();

      // Calculate theoretical max HR based on age
      let theoreticalMaxHR = 190; // Default fallback
      if (profile?.birth_date) {
        const birthDate = new Date(profile.birth_date);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear() - 
          (today.getMonth() < birthDate.getMonth() || 
           (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);
        theoreticalMaxHR = 220 - age;
        console.log('🔍 ZONES: User age:', age, 'Theoretical Max HR:', theoreticalMaxHR);
      }

      // Calculate max HR from valid data only
      const validHRValues = validHRRecords.map(d => d.heart_rate);
      const dataMaxHR = Math.max(...validHRValues);
      
      // Use user-provided max HR, or theoretical max HR, or data max HR as fallback
      const maxHR = userMaxHR || theoreticalMaxHR;
      
      console.log('🔍 ZONES: Max HR used for zones:', maxHR);

      // Get HR distribution for debugging
      const allHRValues = activityDetails.map(d => d.heart_rate).sort((a, b) => a - b);
      const minDataHR = Math.min(...allHRValues);
      const maxDataHR = Math.max(...allHRValues);
      
      console.log('🔍 ZONES: HR Distribution Analysis:', {
        totalRecords: activityDetails.length,
        minHR: minDataHR,
        maxHR: maxDataHR,
        calculatedMaxHR: maxHR,
        hrSample: allHRValues.slice(0, 10)
      });

      // Define heart rate zones based on % of max HR - expanded to capture all data
      const zoneDefinitions = [
        { zone: 'Zona 1', label: 'Recuperação', minPercent: 0, maxPercent: 60, color: 'bg-blue-500' },
        { zone: 'Zona 2', label: 'Aeróbica', minPercent: 60, maxPercent: 70, color: 'bg-green-500' },
        { zone: 'Zona 3', label: 'Limiar', minPercent: 70, maxPercent: 80, color: 'bg-yellow-500' },
        { zone: 'Zona 4', label: 'Anaeróbica', minPercent: 80, maxPercent: 90, color: 'bg-orange-500' },
        { zone: 'Zona 5', label: 'Máxima', minPercent: 90, maxPercent: 150, color: 'bg-red-500' } // Extended to capture all high HR
      ];

      // Check if we have the expected 2,160 records for 36 minutes (2,160 seconds)
      const totalRecords = validHRRecords.length;
      const expectedSecondsFor36Min = 36 * 60; // 2,160 seconds
      
      // If we have exactly 2,160 records for 36 minutes, then 1 record = 1 second
      const recordsPerSecond = totalRecords === expectedSecondsFor36Min ? 1 : (totalRecords / expectedSecondsFor36Min);
      const actualDurationSeconds = Math.round(totalRecords / recordsPerSecond);
      
      console.log('🔍 ZONES: Time calculation:', {
        totalRecords,
        expectedRecordsFor36Min: expectedSecondsFor36Min,
        recordsPerSecond,
        calculatedDurationSeconds: actualDurationSeconds,
        durationMinutes: Math.round(actualDurationSeconds / 60)
      });
      
      let totalCounted = 0;
      
      const calculatedZones: HeartRateZone[] = zoneDefinitions.map((zoneDef, index) => {
        const minHR = Math.round((zoneDef.minPercent / 100) * maxHR);
        const maxHR_zone = Math.round((zoneDef.maxPercent / 100) * maxHR);
        
        // Count how many records fall within this zone
        const recordsInZone = validHRRecords.filter(record => {
          const hr = record.heart_rate;
          if (index === zoneDefinitions.length - 1) {
            // Last zone: capture everything >= minHR
            return hr >= minHR;
          } else {
            // Other zones: minHR <= hr < maxHR_zone
            return hr >= minHR && hr < maxHR_zone;
          }
        }).length;

        // Convert records to actual time based on calculated records per second
        const secondsInZone = Math.round(recordsInZone / recordsPerSecond);
        totalCounted += recordsInZone;
        
        const percentage = totalRecords > 0 ? Math.round((recordsInZone / totalRecords) * 100) : 0;

        return {
          zone: zoneDef.zone,
          label: zoneDef.label,
          minHR,
          maxHR: maxHR_zone,
          percentage,
          timeInZone: secondsInZone, // Now converted to actual seconds
          color: zoneDef.color
        };
      });

      console.log('🔍 ZONES: Zone distribution:', calculatedZones.map(z => ({
        zone: z.zone,
        range: `${z.minHR}-${z.maxHR} bpm`,
        records: Math.round(z.timeInZone * 5), // Back to records for verification
        seconds: z.timeInZone,
        percentage: z.percentage + '%'
      })));

      console.log('🔍 ZONES: Verification:', {
        totalRecords: totalRecords,
        totalCounted: totalCounted,
        uncountedRecords: totalRecords - totalCounted,
        accountedPercentage: Math.round((totalCounted / totalRecords) * 100) + '%',
        totalSecondsCalculated: calculatedZones.reduce((sum, zone) => sum + zone.timeInZone, 0),
        expectedSeconds: Math.round(actualDurationSeconds)
      });

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