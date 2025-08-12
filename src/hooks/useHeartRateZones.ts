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

      // Detect source by activityId format: numeric => Strava, otherwise Garmin
      const isStrava = /^\d+$/.test(id);

      // Fetch details depending on source
      let activityDetails: any[] | null = null;
      if (isStrava) {
        const stravaId = Number(id);
        const { data: stravaDetails, error: stravaErr } = await supabase
          .from('strava_activity_details')
          .select('heartrate, time_seconds, time_index')
          .eq('strava_activity_id', stravaId)
          .order('time_index', { ascending: true });
        if (stravaErr) throw stravaErr;

        // If not found, try to fetch from Strava API and retry once
        if (!stravaDetails || stravaDetails.length === 0) {
          console.log('🔁 ZONES: No Strava details found. Invoking edge function to fetch streams...');
          try {
            await supabase.functions.invoke('strava-activity-streams', {
              body: { activity_id: stravaId }
            });
            const { data: retryDetails } = await supabase
              .from('strava_activity_details')
              .select('heartrate, time_seconds, time_index')
              .eq('strava_activity_id', stravaId)
              .order('time_index', { ascending: true });
            activityDetails = retryDetails || [];
          } catch (fetchErr) {
            console.warn('⚠️ ZONES: Failed to fetch Strava streams:', fetchErr);
            activityDetails = [];
          }
        } else {
          activityDetails = stravaDetails;
        }
      } else {
        const { data: garminDetails, error: garminErr } = await supabase
          .from('garmin_activity_details')
          .select('heart_rate, sample_timestamp')
          .eq('user_id', user.id)
          .eq('activity_id', id)
          .order('sample_timestamp', { ascending: true });
        if (garminErr) throw garminErr;
        activityDetails = garminDetails || [];
      }

      console.log('🔍 ZONES: Raw query results:', {
        totalRecords: activityDetails?.length || 0,
        sampleData: activityDetails?.slice(0, 5)
      });

      if (!activityDetails || activityDetails.length === 0) {
        setZones([]);
        return;
      }

      // Normalize to a common [{ hr, t }] shape, where t = seconds from start if available
      type Sample = { hr: number; t?: number };
      const samples: Sample[] = activityDetails
        .map((d: any) => {
          const hr: number | null = isStrava ? (d.heartrate ?? null) : (d.heart_rate ?? null);
          const t: number | undefined = isStrava
            ? (typeof d.time_seconds === 'number' ? d.time_seconds : (typeof d.time_index === 'number' ? d.time_index : undefined))
            : (typeof d.sample_timestamp === 'number' ? d.sample_timestamp : undefined);
          return hr != null ? { hr: Number(hr), t } : null;
        })
        .filter(Boolean) as Sample[];

      if (samples.length === 0) {
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

      // Determine max HR basis
      const dataMaxHR = Math.max(...samples.map(s => s.hr));
      const maxHR = userMaxHR || theoreticalMaxHR || dataMaxHR;
      console.log('🔍 ZONES: Max HR used for zones:', maxHR, '(data max:', dataMaxHR, ')');

      // Define heart rate zones based on % of max HR
      const zoneDefinitions = [
        { zone: 'Zona 1', label: 'Recuperação', minPercent: 0,  maxPercent: 60,  color: 'bg-blue-500' },
        { zone: 'Zona 2', label: 'Aeróbica',    minPercent: 60, maxPercent: 70,  color: 'bg-green-500' },
        { zone: 'Zona 3', label: 'Limiar',      minPercent: 70, maxPercent: 80,  color: 'bg-yellow-500' },
        { zone: 'Zona 4', label: 'Anaeróbica',  minPercent: 80, maxPercent: 90,  color: 'bg-orange-500' },
        { zone: 'Zona 5', label: 'Máxima',      minPercent: 90, maxPercent: 150, color: 'bg-red-500' },
      ];

      // Compute per-sample durations (dt)
      // If timestamps available, use differences; otherwise assume 1s per sample
      let totalSeconds = 0;
      const dts: number[] = new Array(samples.length).fill(1);
      if (samples[0].t != null) {
        for (let i = 0; i < samples.length; i++) {
          const t0 = samples[i].t!;
          const t1 = i < samples.length - 1 ? samples[i + 1].t! : t0 + 1;
          const dt = Math.max(1, Math.round(t1 - t0));
          dts[i] = dt;
        }
      }
      totalSeconds = dts.reduce((a, b) => a + b, 0);

      const calculatedZones: HeartRateZone[] = zoneDefinitions.map((zoneDef, index) => {
        const minHR = Math.round((zoneDef.minPercent / 100) * maxHR);
        const maxHR_zone = Math.round((zoneDef.maxPercent / 100) * maxHR);

        let secondsInZone = 0;
        for (let i = 0; i < samples.length; i++) {
          const hr = samples[i].hr;
          const inZone = index === zoneDefinitions.length - 1
            ? hr >= minHR
            : hr >= minHR && hr < maxHR_zone;
          if (inZone) secondsInZone += dts[i];
        }

        const percentage = totalSeconds > 0 ? Math.round((secondsInZone / totalSeconds) * 100) : 0;
        return {
          zone: zoneDef.zone,
          label: zoneDef.label,
          minHR,
          maxHR: maxHR_zone,
          percentage,
          timeInZone: secondsInZone,
          color: zoneDef.color,
        };
      });

      console.log('🔍 ZONES: Zone distribution:', calculatedZones.map(z => ({
        zone: z.zone,
        range: `${z.minHR}-${z.maxHR} bpm`,
        seconds: z.timeInZone,
        percentage: z.percentage + '%'
      })));

      console.log('🔍 ZONES: Totals:', {
        totalSeconds,
        sumSecondsZones: calculatedZones.reduce((sum, zone) => sum + zone.timeInZone, 0)
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