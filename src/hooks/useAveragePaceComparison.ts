import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getCache, setCache, CACHE_KEYS, CACHE_DURATIONS } from '@/lib/cache';
import { isCyclingActivity, isSwimmingActivity } from '@/utils/activityTypeUtils';

type PaceCategory = 'RUNNING' | 'CYCLING' | 'SWIMMING';

interface AveragePaceData {
  category: string;
  average_pace_value: number;
  pace_unit: string;
  total_activities: number;
  period_start: string;
  period_end: string;
  calculated_at: string;
}

export interface PaceComparisonResult {
  currentPace: number;
  communityAverage: number;
  difference: number;
  percentDifference: number;
  isFasterThanAverage: boolean;
  category: PaceCategory;
  unit: string;
  totalActivities: number;
  periodStart: string;
  periodEnd: string;
}

const RUNNING_TYPES = [
  'run', 'running', 'treadmill_running', 'trail_running', 'virtualrun',
  'virtual_run', 'track_running', 'indoor_running'
];

const CYCLING_TYPES = [
  'ride', 'cycling', 'road_biking', 'mountain_biking', 'virtualride',
  'virtual_ride', 'indoor_cycling', 'ebikeride', 'velomobile'
];

const SWIMMING_TYPES = [
  'swim', 'lap_swimming', 'open_water_swimming', 'swimming'
];

function mapActivityTypeToCategory(activityType: string | null): PaceCategory | null {
  if (!activityType) return null;
  
  const lower = activityType.toLowerCase();
  
  if (RUNNING_TYPES.some(t => lower.includes(t))) return 'RUNNING';
  if (CYCLING_TYPES.some(t => lower.includes(t))) return 'CYCLING';
  if (SWIMMING_TYPES.some(t => lower.includes(t))) return 'SWIMMING';
  
  return null;
}

function getUnitForCategory(category: PaceCategory): string {
  switch (category) {
    case 'RUNNING': return 'min/km';
    case 'CYCLING': return 'km/h';
    case 'SWIMMING': return 'min/100m';
  }
}

export function useAveragePaceComparison(
  currentPace: number | null | undefined,
  activityType: string | null | undefined
) {
  const { user } = useAuth();
  const [averagePaceData, setAveragePaceData] = useState<AveragePaceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = useMemo(() => mapActivityTypeToCategory(activityType || null), [activityType]);

  useEffect(() => {
    if (!category) {
      setAveragePaceData(null);
      return;
    }

    const fetchAveragePace = async () => {
      // Check cache first
      const cacheKey = `${CACHE_KEYS.AVERAGE_PACE}_${category}`;
      const cached = getCache<AveragePaceData>(cacheKey, 'global', CACHE_DURATIONS.DAILY);
      
      if (cached) {
        setAveragePaceData(cached);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('average_pace')
          .select('*')
          .eq('category', category)
          .order('calculated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (queryError) throw queryError;

        if (data) {
          setAveragePaceData(data);
          setCache(cacheKey, data, 'global');
        } else {
          setAveragePaceData(null);
        }
      } catch (err) {
        console.error('[useAveragePaceComparison] Error fetching average pace:', err);
        setError('Erro ao buscar dados de comparação');
      } finally {
        setLoading(false);
      }
    };

    fetchAveragePace();
  }, [category]);

  const comparison = useMemo((): PaceComparisonResult | null => {
    if (!currentPace || currentPace <= 0 || !category || !averagePaceData) {
      return null;
    }

    const communityAverage = averagePaceData.average_pace_value;
    
    if (!communityAverage || communityAverage <= 0) {
      return null;
    }

    // For RUNNING: lower pace is faster (min/km) - community avg is in min/km
    // For CYCLING: higher speed is faster (km/h) - community avg is in km/h
    // For SWIMMING: lower pace is faster (min/100m) - community avg is in min/100m
    
    let difference: number;
    let percentDifference: number;
    let isFasterThanAverage: boolean;

    if (category === 'CYCLING') {
      // For cycling, convert current pace (min/km) to speed (km/h)
      const currentSpeed = 60 / currentPace;
      difference = currentSpeed - communityAverage;
      percentDifference = Math.abs(difference / communityAverage) * 100;
      isFasterThanAverage = currentSpeed > communityAverage;
    } else if (category === 'SWIMMING') {
      // For swimming, convert current pace from min/km to min/100m for comparison
      const currentPacePer100m = currentPace / 10;
      difference = communityAverage - currentPacePer100m;
      percentDifference = Math.abs(difference / communityAverage) * 100;
      isFasterThanAverage = currentPacePer100m < communityAverage;
    } else {
      // For running, both values are in min/km
      difference = communityAverage - currentPace;
      percentDifference = Math.abs(difference / communityAverage) * 100;
      isFasterThanAverage = currentPace < communityAverage;
    }

    return {
      currentPace,
      communityAverage,
      difference: Math.abs(difference),
      percentDifference: Math.round(percentDifference * 10) / 10,
      isFasterThanAverage,
      category,
      unit: getUnitForCategory(category),
      totalActivities: averagePaceData.total_activities,
      periodStart: averagePaceData.period_start,
      periodEnd: averagePaceData.period_end,
    };
  }, [currentPace, category, averagePaceData]);

  return {
    comparison,
    loading,
    error,
    hasData: !!comparison,
  };
}
