import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Fastest1KmSegment {
  start_distance_m: number;
  end_distance_m: number;
  segment_length_m: number;
  avg_pace_min_km: number;
  duration_seconds: number;
}

interface UseFastest1KmSegmentReturn {
  segment: Fastest1KmSegment | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFastest1KmSegment(
  activityId: string | null,
  activitySource: string = 'garmin'
): UseFastest1KmSegmentReturn {
  const [segment, setSegment] = useState<Fastest1KmSegment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFastest1KmSegment = async () => {
    if (!activityId) {
      setSegment(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }

      const { data, error: rpcError } = await supabase.rpc('find_fastest_1km_segment', {
        p_user_id: userData.user.id,
        p_activity_id: activityId,
        p_activity_source: activitySource
      });

      if (rpcError) {
        throw rpcError;
      }

      setSegment(data);
    } catch (err) {
      console.error('Error finding fastest 1km segment:', err);
      setError(err instanceof Error ? err.message : 'Failed to find fastest 1km segment');
      setSegment(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFastest1KmSegment();
  }, [activityId, activitySource]);

  return {
    segment,
    loading,
    error,
    refetch: fetchFastest1KmSegment
  };
}

// Helper function to format pace display
export function formatPace(paceMinKm: number): string {
  const minutes = Math.floor(paceMinKm);
  const seconds = Math.round((paceMinKm - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

// Helper function to format distance display
export function formatDistance(distanceM: number): string {
  if (distanceM >= 1000) {
    return `${(distanceM / 1000).toFixed(2)}km`;
  }
  return `${Math.round(distanceM)}m`;
}

// Helper function to format duration display
export function formatDuration(durationSeconds: number): string {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}s`;
}