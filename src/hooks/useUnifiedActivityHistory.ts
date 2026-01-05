import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getCache, setCache, CACHE_KEYS, CACHE_DURATIONS } from '@/lib/cache';

export interface UnifiedActivity {
  id: string;
  activity_id: string;
  source: 'GARMIN' | 'STRAVA' | 'POLAR' | 'BIOPEAK' | 'ZEPP' | 'ZEPP_GPX' | 'HEALTHKIT';
  activity_type: string | null;
  activity_date: string | null;
  duration_in_seconds: number | null;
  distance_in_meters: number | null;
  average_pace_in_minutes_per_kilometer: number | null;
  average_heart_rate_in_beats_per_minute: number | null;
  max_heart_rate_in_beats_per_minute: number | null;
  active_kilocalories: number | null;
  total_elevation_gain_in_meters: number | null;
  total_elevation_loss_in_meters: number | null;
  device_name: string | null;
  start_time_in_seconds: number | null;
  start_time_offset_in_seconds: number | null;
  average_speed_in_meters_per_second: number | null;
  max_speed_in_meters_per_second: number | null;
  steps: number | null;
  synced_at: string;
  strava_activity_id?: number;
  name?: string;
  polar_user?: string;
  detailed_sport_info?: string;
  detected_workout_type?: string | null;
}

interface CachedActivitiesData {
  activities: UnifiedActivity[];
  limit: number;
}

export function useUnifiedActivityHistory(limit: number = 20) {
  const { user } = useAuth();
  
  // Initialize with cache for instant loading
  const cacheKey = `${CACHE_KEYS.ACTIVITIES}_${limit}`;
  const cached = getCache<CachedActivitiesData>(
    cacheKey,
    user?.id,
    CACHE_DURATIONS.MEDIUM
  );
  
  const [activities, setActivities] = useState<UnifiedActivity[]>(
    cached?.limit === limit ? cached.activities : []
  );
  const [loading, setLoading] = useState(!cached || cached.limit !== limit);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setActivities([]);
      setLoading(false);
      return;
    }

    // If we have cache with same limit, show it immediately and refresh in background
    if (cached && cached.limit === limit) {
      setActivities(cached.activities);
      setLoading(false);
      fetchUnifiedActivities(false);
    } else {
      fetchUnifiedActivities(true);
    }
  }, [user?.id, limit]);

  const fetchUnifiedActivities = async (showLoading = true) => {
    if (!user) return;

    try {
      if (showLoading) setLoading(true);
      setError(null);

      const { data: activitiesData, error } = await supabase
        .from('all_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('activity_date', { ascending: false })
        .limit(limit);

      if (error) throw error;

      if (!activitiesData || activitiesData.length === 0) {
        setActivities([]);
        setCache(cacheKey, { activities: [], limit }, user.id);
        return;
      }

      const unifiedActivities: UnifiedActivity[] = activitiesData.map((activity: any) => ({
        id: activity.id,
        activity_id: activity.activity_id,
        source: mapActivitySource(activity.activity_source),
        activity_type: activity.activity_type,
        activity_date: activity.activity_date,
        duration_in_seconds: activity.total_time_minutes ? Math.round(activity.total_time_minutes * 60) : null,
        distance_in_meters: activity.total_distance_meters,
        average_pace_in_minutes_per_kilometer: activity.pace_min_per_km,
        average_heart_rate_in_beats_per_minute: activity.average_heart_rate,
        max_heart_rate_in_beats_per_minute: activity.max_heart_rate,
        active_kilocalories: activity.active_kilocalories,
        total_elevation_gain_in_meters: activity.total_elevation_gain_in_meters,
        total_elevation_loss_in_meters: activity.total_elevation_loss_in_meters,
        device_name: activity.device_name || mapActivitySource(activity.activity_source),
        start_time_in_seconds: null,
        start_time_offset_in_seconds: null,
        average_speed_in_meters_per_second: null,
        max_speed_in_meters_per_second: null,
        steps: null,
        synced_at: activity.created_at,
        detected_workout_type: activity.detected_workout_type ?? null,
      }));

      setActivities(unifiedActivities);
      setCache(cacheKey, { activities: unifiedActivities, limit }, user.id);
    } catch (err) {
      console.error('Error fetching unified activity history:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar histórico';
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        console.warn('Network error detected, setting empty activities to prevent loop');
        setActivities([]);
      }
      
      setError(errorMessage);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const getActivityById = (activityId: string): UnifiedActivity | undefined => {
    return activities.find(activity => activity.id === activityId);
  };

  const formatActivityDisplay = (activity: UnifiedActivity): string => {
    const date = activity.activity_date ? new Date(activity.activity_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data N/A';
    const type = getActivityTypeLabel(activity.activity_type);
    const distance = activity.distance_in_meters ? `${(activity.distance_in_meters / 1000).toFixed(1)}km` : '';
    const duration = activity.duration_in_seconds ? formatDuration(activity.duration_in_seconds) : '';
    const sourceLabel = activity.device_name === 'Strava GPX' 
      ? 'Strava GPX' 
      : activity.device_name === 'Zepp GPX'
      ? 'Zepp GPX'
      : activity.source === 'ZEPP'
      ? 'Zepp Sync'
      : activity.source === 'HEALTHKIT'
      ? 'Apple Watch'
      : (activity.source === 'BIOPEAK' ? 'BioPeak AI Coach' : activity.source);
    return `${date} - ${type} ${distance} ${duration} [${sourceLabel}]`.trim();
  };

  const getActivityTypeLabel = (type: string | null): string => {
    if (!type) return 'Atividade';
    const typeMap: { [key: string]: string } = {
      'RUNNING': 'Corrida',
      'Run': 'Corrida',
      'running': 'Corrida',
      'CYCLING': 'Ciclismo',
      'Ride': 'Ciclismo', 
      'cycling': 'Ciclismo',
      'WALKING': 'Caminhada',
      'Walk': 'Caminhada',
      'walking': 'Caminhada',
      'SWIMMING': 'Natação',
      'Swim': 'Natação',
      'swimming': 'Natação',
      'FITNESS_EQUIPMENT': 'Academia',
      'Workout': 'Academia'
    };
    return typeMap[type] || type;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h${minutes}m`;
    }
    return `${minutes}m`;
  };

  const mapActivitySource = (source: string): 'GARMIN' | 'STRAVA' | 'POLAR' | 'BIOPEAK' | 'ZEPP' | 'ZEPP_GPX' | 'HEALTHKIT' => {
    const sourceMap: Record<string, 'GARMIN' | 'STRAVA' | 'POLAR' | 'BIOPEAK' | 'ZEPP' | 'ZEPP_GPX' | 'HEALTHKIT'> = {
      'garmin': 'GARMIN',
      'strava': 'STRAVA', 
      'strava_gpx': 'STRAVA',
      'polar': 'POLAR',
      'biopeak': 'BIOPEAK',
      'zepp': 'ZEPP',
      'zepp_gpx': 'ZEPP_GPX',
      'healthkit': 'HEALTHKIT'
    };
    return sourceMap[source] || 'BIOPEAK';
  };

  return {
    activities,
    loading,
    error,
    getActivityById,
    formatActivityDisplay,
    getActivityTypeLabel,
    refetch: () => fetchUnifiedActivities(true)
  };
}
