
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AthleteStats {
  avgPaceMinKm: number | null;
  avgHeartRate: number | null;
  avgDistanceKm: number | null;
  avgVo2MaxDaniels: number | null;
  totalActivities: number;
}

export function useAthleteStats() {
  const [stats, setStats] = useState<AthleteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setStats(null);
      setLoading(false);
      return;
    }

    fetchAthleteStats();
  }, [user]);

  const fetchAthleteStats = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Buscar últimas 30 atividades de corrida da view unificada
      const { data: activities, error } = await supabase
        .from('v_all_activities_with_vo2_daniels')
        .select('*')
        .eq('user_id', user.id)
        .ilike('activity_type', '%run%') // Filtrar apenas atividades de corrida
        .order('activity_date', { ascending: false })
        .limit(30);

      if (error) throw error;

      if (!activities || activities.length === 0) {
        setStats({
          avgPaceMinKm: null,
          avgHeartRate: null,
          avgDistanceKm: null,
          avgVo2MaxDaniels: null,
          totalActivities: 0
        });
        return;
      }

      // Calcular médias apenas de valores válidos
      const validPaces = activities
        .map(a => a.pace_min_per_km)
        .filter(p => p !== null && p !== undefined && p > 0);
      
      const validHR = activities
        .map(a => a.average_heart_rate)
        .filter(hr => hr !== null && hr !== undefined && hr > 0);
      
      const validDistances = activities
        .map(a => a.total_distance_meters)
        .filter(d => d !== null && d !== undefined && d > 0)
        .map(d => d / 1000); // Converter para KM
      
      const validVo2Max = activities
        .map(a => a.vo2_max_daniels)
        .filter(v => v !== null && v !== undefined && v > 0);

      const calculateAverage = (values: number[]) => 
        values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : null;

      setStats({
        avgPaceMinKm: calculateAverage(validPaces),
        avgHeartRate: calculateAverage(validHR),
        avgDistanceKm: calculateAverage(validDistances),
        avgVo2MaxDaniels: calculateAverage(validVo2Max),
        totalActivities: activities.length
      });

    } catch (err) {
      console.error('Error fetching athlete stats:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const formatPace = (paceMinKm: number | null) => {
    if (paceMinKm === null) return 'N/A';
    const minutes = Math.floor(paceMinKm);
    const seconds = Math.round((paceMinKm % 1) * 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
  };

  const formatDistance = (distanceKm: number | null) => {
    if (distanceKm === null) return 'N/A';
    return `${distanceKm.toFixed(1)} km`;
  };

  const formatHeartRate = (hr: number | null) => {
    if (hr === null) return 'N/A';
    return `${Math.round(hr)} bpm`;
  };

  const formatVo2Max = (vo2: number | null) => {
    if (vo2 === null) return 'N/A';
    return `${vo2.toFixed(1)} ml/kg/min`;
  };

  return {
    stats,
    loading,
    error,
    refetch: fetchAthleteStats,
    formatPace,
    formatDistance,
    formatHeartRate,
    formatVo2Max
  };
}
