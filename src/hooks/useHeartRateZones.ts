import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { HRZonesConfig, DEFAULT_HR_ZONES, ZONE_COLORS } from '@/types/heartRateZones';

export interface HeartRateZone {
  zone: string;
  label: string;
  minHR: number;
  maxHR: number;
  percentage: number;
  timeInZone: number;
  color: string;
}

type ZoneKey = 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5';
const ZONE_KEYS: ZoneKey[] = ['zone1', 'zone2', 'zone3', 'zone4', 'zone5'];

export const useHeartRateZones = (activityId: string | null, userMaxHR?: number) => {
  const [zones, setZones] = useState<HeartRateZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // NEW: try activity_chart_data first (for Garmin and Strava)
  const tryLoadZonesFromActivityChartData = async (id: string): Promise<boolean> => {
    console.log('⚡ ZONES: Trying activity_chart_data for', id);
    
    try {
      const { data: chartData, error } = await supabase
        .from('activity_chart_data')
        .select('series_data, activity_source')
        .eq('activity_id', id)
        .single();

      if (error || !chartData?.series_data || !Array.isArray(chartData.series_data)) {
        console.log('❌ No data in activity_chart_data for zones:', error?.message);
        return false;
      }

      console.log(`✅ Found ${chartData.series_data.length} data points from activity_chart_data (${chartData.activity_source})`);

      // Extract heart rate data from series_data
      const heartRateData = chartData.series_data
        .map((point: any) => point.heart_rate || point.hr)
        .filter((hr: number) => hr && hr > 0);

      if (heartRateData.length === 0) {
        console.log('❌ No heart rate data found in activity_chart_data');
        return false;
      }

      // Calculate zones using the heart rate data
      await calculateZonesFromHeartRateData(heartRateData);
      return true;

    } catch (err) {
      console.error('❌ Error fetching from activity_chart_data for zones:', err);
      return false;
    }
  };

  // Helper function to get zone definitions from profile or defaults
  const getZoneDefinitions = (profileZones: HRZonesConfig | null) => {
    const zones = profileZones || DEFAULT_HR_ZONES;
    return ZONE_KEYS.map((key, index) => ({
      zone: `Zona ${index + 1}`,
      label: zones[key].label,
      minPercent: zones[key].minPercent,
      maxPercent: zones[key].maxPercent,
      color: ZONE_COLORS[key],
    }));
  };

  // Helper function to calculate zones from heart rate array
  const calculateZonesFromHeartRateData = async (heartRateData: number[]) => {
    // Get user's profile including custom HR settings
    const { data: profile } = await supabase
      .from('profiles')
      .select('birth_date, max_heart_rate, hr_zones')
      .eq('user_id', user.id)
      .single();

    // Priority 1: Profile's custom max_heart_rate
    // Priority 2: userMaxHR parameter
    // Priority 3: Theoretical (220 - age)
    // Priority 4: Max from data
    let theoreticalMaxHR = 190;
    if (profile?.birth_date) {
      const birthDate = new Date(profile.birth_date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear() -
        (today.getMonth() < birthDate.getMonth() ||
         (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);
      theoreticalMaxHR = 220 - age;
      console.log('🔍 ZONES: User age:', age, 'Theoretical Max HR:', theoreticalMaxHR);
    }

    const dataMaxHR = Math.max(...heartRateData);
    const profileMaxHR = profile?.max_heart_rate;
    const maxHR = profileMaxHR || userMaxHR || theoreticalMaxHR || dataMaxHR;
    
    console.log('🔍 ZONES: Max HR sources:', {
      profileMaxHR,
      userMaxHR,
      theoreticalMaxHR,
      dataMaxHR,
      using: maxHR
    });

    // Get zone definitions from profile or use defaults
    const customZones = profile?.hr_zones as HRZonesConfig | null;
    const zoneDefinitions = getZoneDefinitions(customZones);
    
    if (customZones) {
      console.log('🔍 ZONES: Using custom zone configuration from profile');
    }

    const totalSamples = heartRateData.length;
    
    const calculatedZones: HeartRateZone[] = zoneDefinitions.map((zoneDef, index) => {
      const minHR = Math.round((zoneDef.minPercent / 100) * maxHR);
      const maxHR_zone = Math.round((zoneDef.maxPercent / 100) * maxHR);

      let samplesInZone = 0;
      for (const hr of heartRateData) {
        const inZone = index === zoneDefinitions.length - 1
          ? hr >= minHR
          : hr >= minHR && hr < maxHR_zone;
        if (inZone) samplesInZone++;
      }

      const percentage = totalSamples > 0 ? Math.round((samplesInZone / totalSamples) * 100) : 0;
      const timeInZone = samplesInZone;

      return {
        zone: zoneDef.zone,
        label: zoneDef.label,
        minHR,
        maxHR: maxHR_zone,
        percentage,
        timeInZone,
        color: zoneDef.color,
      };
    });

    console.log('🔍 ZONES: Zone distribution from chart data:', calculatedZones.map(z => ({
      zone: z.zone,
      range: `${z.minHR}-${z.maxHR} bpm`,
      samples: z.timeInZone,
      percentage: z.percentage + '%'
    })));

    setZones(calculatedZones);
  };

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

      // PRIORITY 1: Try activity_chart_data first (for Garmin and Strava)
      const chartDataSuccess = await tryLoadZonesFromActivityChartData(id);
      if (chartDataSuccess) {
        setLoading(false);
        return;
      }

      // PRIORITY 2: Cache-first
      const cacheHit = await tryLoadZonesFromCache(id);
      if (cacheHit) {
        setLoading(false);
        return;
      }

      // PRIORITY 3: Legacy data sources (Polar, GPX, etc.)
      console.log('🔍 ZONES: Fallback to legacy data sources');

      // Optional: trigger builder in background to speed up futuras visualizações
      supabase.functions.invoke('build-activity-chart-cache', {
        body: { activity_id: id, version: 1 }
      }).catch((e) => console.warn('⚠️ ZONES builder invoke error:', e?.message || e));

      // Only GPX sources for fallback (Polar, Strava GPX, Zepp GPX)
      let activityDetails: any[] | null = null;

      // Try GPX-derived details by activity_id (Polar, Strava GPX, Zepp GPX)
      console.log('🔍 ZONES: Trying GPX sources as fallback');
      
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

      // Get user's profile including custom HR settings
      const { data: profile } = await supabase
        .from('profiles')
        .select('birth_date, max_heart_rate, hr_zones')
        .eq('user_id', user.id)
        .single();

      // Calculate theoretical max HR based on age
      let theoreticalMaxHR = 190;
      if (profile?.birth_date) {
        const birthDate = new Date(profile.birth_date);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear() -
          (today.getMonth() < birthDate.getMonth() ||
           (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);
        theoreticalMaxHR = 220 - age;
        console.log('🔍 ZONES: User age:', age, 'Theoretical Max HR:', theoreticalMaxHR);
      }

      // Priority: profile max_heart_rate > userMaxHR > theoretical > data max
      const dataMaxHR = Math.max(...samples.map(s => s.hr));
      const profileMaxHR = profile?.max_heart_rate;
      const maxHR = profileMaxHR || userMaxHR || theoreticalMaxHR || dataMaxHR;
      
      console.log('🔍 ZONES: Max HR sources:', {
        profileMaxHR,
        userMaxHR,
        theoreticalMaxHR,
        dataMaxHR,
        using: maxHR
      });

      // Get zone definitions from profile or use defaults
      const customZones = profile?.hr_zones as HRZonesConfig | null;
      const zoneDefinitions = getZoneDefinitions(customZones);
      
      if (customZones) {
        console.log('🔍 ZONES: Using custom zone configuration from profile');
      }

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
