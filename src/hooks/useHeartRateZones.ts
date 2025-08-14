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

  // NEW: try precomputed zones from cache first
  const tryLoadZonesFromCache = async (id: string): Promise<boolean> => {
    console.log('⚡ ZONES Cache: trying to load zones for', id);
    // Try multiple possible sources for better cache hit rate
    const { data: cached, error: cacheErr } = await supabase
      .from('activity_chart_cache')
      .select('zones, build_status, activity_source')
      .eq('activity_id', id)
      .eq('version', 1)
      .in('activity_source', ['garmin', 'polar', 'strava', 'strava_gpx', 'zepp_gpx'])
      .order('built_at', { ascending: false })
      .limit(1);
    if (cacheErr) {
      console.warn('⚠️ ZONES cache error:', cacheErr.message);
    }
    const row = cached?.[0];
    if (row && row.build_status === 'ready' && Array.isArray(row.zones) && row.zones.length > 0) {
      console.log('✅ Using cached zones from source:', row.activity_source);
      const mapped: HeartRateZone[] = row.zones.map((z: any) => ({
        zone: String(z.zone ?? ''),
        label: String(z.label ?? ''),
        minHR: Number(z.minHR ?? z.minHr ?? 0),
        maxHR: Number(z.maxHR ?? z.maxHr ?? 0),
        percentage: Number(z.percentage ?? 0),
        timeInZone: Number(z.timeInZone ?? z.timeSec ?? 0),
        color: String(z.color ?? 'bg-blue-500'),
      }));
      setZones(mapped);
      return true;
    }
    return false;
  };

  const calculateZones = async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 ZONES: Calculating zones for activity ID:', id, 'User ID:', user?.id);

      // NEW: Cache-first
      const cacheHit = await tryLoadZonesFromCache(id);
      if (cacheHit) {
        setLoading(false);
        return;
      }

      // Optional: trigger builder in background to speed up futuras visualizações
      supabase.functions.invoke('build-activity-chart-cache', {
        body: { activity_id: id, version: 1 }
      }).catch((e) => console.warn('⚠️ ZONES builder invoke error:', e?.message || e));

      // Robust source detection: try Garmin first, then Strava, then GPX fallback
      let activityDetails: any[] | null = null;

      // 1) Try Garmin details for this user/activity
      const { data: garminDetails, error: garminErr } = await supabase
        .from('garmin_activity_details')
        .select('heart_rate, sample_timestamp')
        .eq('user_id', user.id)
        .eq('activity_id', id)
        .order('sample_timestamp', { ascending: true });
      if (garminErr) throw garminErr;

      if (garminDetails && garminDetails.length > 0) {
        activityDetails = garminDetails;
      } else {
        // 2) Try Strava details if the id is numeric
        const stravaId = Number(id);
        if (!Number.isNaN(stravaId)) {
          const { data: stravaDetails, error: stravaErr } = await supabase
            .from('strava_activity_details')
            .select('heartrate, time_seconds, time_index')
            .eq('strava_activity_id', stravaId)
            .order('time_index', { ascending: true });
          if (stravaErr) throw stravaErr;

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
        }

        // 3) Fallback: try GPX-derived details by activity_id (Strava and Zepp)
        if (!activityDetails || activityDetails.length === 0) {
          // Try Strava GPX first
          const { data: stravaGpxDetails, error: stravaGpxErr } = await supabase
            .from('strava_gpx_activity_details')
            .select('heart_rate, sample_timestamp')
            .eq('activity_id', id)
            .order('sample_timestamp', { ascending: true });
          if (stravaGpxErr) throw stravaGpxErr;
          
          if (stravaGpxDetails && stravaGpxDetails.length > 0) {
            activityDetails = stravaGpxDetails;
          } else {
            // Try Zepp GPX if no Strava GPX data
            const { data: zeppGpxDetails, error: zeppGpxErr } = await supabase
              .from('zepp_gpx_activity_details')
              .select('heart_rate, sample_timestamp')
              .eq('activity_id', id)
              .order('sample_timestamp', { ascending: true });
            if (zeppGpxErr) throw zeppGpxErr;
            activityDetails = zeppGpxDetails || [];
          }
        }
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
      const samples: Sample[] = (activityDetails || [])
        .map((d: any) => {
          const hr: number | null = (d.heartrate ?? d.heart_rate ?? null);
          let t: number | undefined;
          
          if (typeof d.time_seconds === 'number') {
            t = d.time_seconds;
          } else if (typeof d.time_index === 'number') {
            t = d.time_index;
          } else if (d.sample_timestamp != null) {
            // Handle ISO timestamp strings for GPX data
            const timestamp = new Date(d.sample_timestamp).getTime();
            if (!isNaN(timestamp)) {
              // Convert to seconds and make relative to first timestamp
              t = Math.floor(timestamp / 1000);
            }
          }
          
          return hr != null && !isNaN(hr) ? { hr: Number(hr), t } : null;
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
      let totalSeconds = 0;
      const dts: number[] = new Array(samples.length).fill(1);
      
      if (samples.length > 0 && samples[0].t != null) {
        // Convert timestamps to relative seconds from start
        const startTime = samples[0].t!;
        for (let i = 0; i < samples.length; i++) {
          if (samples[i].t != null) {
            const relativeTime = samples[i].t! - startTime;
            const nextTime = (i < samples.length - 1 && samples[i + 1].t != null) 
              ? samples[i + 1].t! - startTime 
              : relativeTime + 1;
            const dt = Math.max(1, Math.round(nextTime - relativeTime));
            dts[i] = dt;
          } else {
            dts[i] = 1; // fallback to 1 second
          }
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
