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

  // Force cache clearing and improved debugging
  const clearCacheAndBuild = async (id: string) => {
    console.log('🗑️ ZONES: Clearing cache for activity:', id);
    try {
      const { error: deleteErr } = await supabase
        .from('activity_chart_cache')
        .delete()
        .eq('activity_id', id);
      if (deleteErr) {
        console.warn('⚠️ ZONES: Cache delete error:', deleteErr.message);
      } else {
        console.log('✅ ZONES: Cache cleared for activity:', id);
      }
    } catch (err) {
      console.warn('⚠️ ZONES: Cache clear failed:', err);
    }
  };

  // Try precomputed zones from cache first
  const tryLoadZonesFromCache = async (id: string): Promise<boolean> => {
    console.log('⚡ ZONES Cache: trying to load zones for', id);
    const { data: cached, error: cacheErr } = await supabase
      .from('activity_chart_cache')
      .select('zones, build_status, activity_source, error_message')
      .eq('activity_id', id)
      .eq('version', 1)
      .order('built_at', { ascending: false })
      .limit(1);
      
    if (cacheErr) {
      console.warn('⚠️ ZONES cache error:', cacheErr.message);
      return false;
    }
    
    const row = cached?.[0];
    console.log('🔍 ZONES Cache result:', { 
      found: !!row, 
      status: row?.build_status, 
      source: row?.activity_source,
      hasZones: Array.isArray(row?.zones) && row.zones.length > 0,
      error: row?.error_message
    });
    
    if (row?.build_status === 'error' && row?.error_message) {
      console.warn('❌ ZONES: Cache shows error:', row.error_message);
      // Clear corrupted cache
      await clearCacheAndBuild(id);
      return false;
    }
    
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

      // Try cache first, but don't let cache failures stop us
      const cacheHit = await tryLoadZonesFromCache(id);
      if (cacheHit) {
        setLoading(false);
        return;
      }

      // If no cache, proceed with fresh calculation

      // Robust source detection: try Garmin first, then Strava, then GPX fallback
      let activityDetails: any[] | null = null;
      console.log('🔍 ZONES: Starting source detection for activity:', id);

      // 1) Try Garmin details for this user/activity
      console.log('🔍 ZONES: Trying Garmin details for activity:', id);
      const { data: garminDetails, error: garminErr } = await supabase
        .from('garmin_activity_details')
        .select('heart_rate, sample_timestamp')
        .eq('user_id', user.id)
        .eq('activity_id', id)
        .order('sample_timestamp', { ascending: true });
      if (garminErr) throw garminErr;

      console.log('🔍 ZONES: Garmin details found:', garminDetails?.length || 0, 'records');
      if (garminDetails && garminDetails.length > 0) {
        activityDetails = garminDetails;
      } else {
        // 2) Try Strava details if the id is numeric
        console.log('🔍 ZONES: No Garmin data, trying Strava for activity:', id);
        const stravaId = Number(id);
        if (!Number.isNaN(stravaId)) {
          console.log('🔍 ZONES: Activity ID is numeric, checking Strava with ID:', stravaId);
          const { data: stravaDetails, error: stravaErr } = await supabase
            .from('strava_activity_details')
            .select('heartrate, time_seconds, time_index')
            .eq('strava_activity_id', stravaId)
            .order('time_index', { ascending: true });
          if (stravaErr) throw stravaErr;

          console.log('🔍 ZONES: Strava details found:', stravaDetails?.length || 0, 'records');
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
              console.log('🔍 ZONES: Retry Strava details found:', retryDetails?.length || 0, 'records');
              activityDetails = retryDetails || [];
            } catch (fetchErr) {
              console.warn('⚠️ ZONES: Failed to fetch Strava streams:', fetchErr);
              activityDetails = [];
            }
          } else {
            activityDetails = stravaDetails;
          }
        } else {
          console.log('🔍 ZONES: Activity ID is not numeric, skipping regular Strava check');
        }

        // 3) Fallback: try GPX-derived details by activity_id (Strava and Zepp)
        if (!activityDetails || activityDetails.length === 0) {
          console.log('🔍 ZONES: No Garmin/Strava data, trying GPX sources for activity:', id);
          
          // Check if this is a Strava GPX activity first
          console.log('🔍 ZONES: Checking if this is a Strava GPX activity...');
          const { data: stravaGpxActivity, error: stravaGpxErr } = await supabase
            .from('strava_gpx_activities')
            .select('activity_id, name, activity_type')
            .eq('id', id)
            .maybeSingle();
          
          console.log('🔍 ZONES: Strava GPX query result:', { 
            found: !!stravaGpxActivity, 
            error: stravaGpxErr?.message,
            activity: stravaGpxActivity 
          });
          
          if (!stravaGpxErr && stravaGpxActivity) {
            console.log('🎯 ZONES: Found Strava GPX activity:', stravaGpxActivity.name, 'type:', stravaGpxActivity.activity_type);
            console.log('🔍 ZONES: Fetching details for activity_id:', stravaGpxActivity.activity_id);
            
            const { data: stravaGpxDetails, error: stravaGpxDetailsErr } = await supabase
              .from('strava_gpx_activity_details')
              .select('heart_rate, sample_timestamp, speed_meters_per_second, distance_km')
              .eq('activity_id', stravaGpxActivity.activity_id)
              .order('sample_timestamp', { ascending: true });
            
            console.log('🔍 ZONES: Strava GPX details query result:', { 
              count: stravaGpxDetails?.length || 0, 
              error: stravaGpxDetailsErr?.message,
              firstFew: stravaGpxDetails?.slice(0, 3)
            });
            
            if (stravaGpxDetailsErr) {
              console.error('❌ ZONES: Strava GPX details error:', stravaGpxDetailsErr);
            } else if (stravaGpxDetails && stravaGpxDetails.length > 0) {
              console.log('✅ ZONES: Using Strava GPX details -', stravaGpxDetails.length, 'records');
              activityDetails = stravaGpxDetails;
            } else {
              console.log('⚠️ ZONES: No Strava GPX details found for activity_id:', stravaGpxActivity.activity_id);
            }
          }
          
          // If still no data, try Zepp GPX
          if (!activityDetails || activityDetails.length === 0) {
            console.log('🔍 ZONES: Trying Zepp GPX for activity:', id);
            const { data: zeppGpxDetails, error: zeppGpxErr } = await supabase
              .from('zepp_gpx_activity_details')
              .select('heart_rate, sample_timestamp')
              .eq('activity_id', id)
              .order('sample_timestamp', { ascending: true });
            
            console.log('🔍 ZONES: Zepp GPX query result:', { 
              count: zeppGpxDetails?.length || 0, 
              error: zeppGpxErr?.message 
            });
            
            if (zeppGpxErr) {
              console.error('❌ ZONES: Zepp GPX error:', zeppGpxErr);
            } else {
              activityDetails = zeppGpxDetails || [];
              if (activityDetails.length > 0) {
                console.log('✅ ZONES: Using Zepp GPX details -', activityDetails.length, 'records');
              }
            }
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
          const t: number | undefined =
            typeof d.time_seconds === 'number' ? d.time_seconds :
            typeof d.time_index === 'number' ? d.time_index :
            (d.sample_timestamp != null ? (
              // sample_timestamp may be in seconds or milliseconds
              (String(d.sample_timestamp).length > 10)
                ? Math.floor(Number(d.sample_timestamp) / 1000)
                : Number(d.sample_timestamp)
            ) : undefined);
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
