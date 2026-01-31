import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SleepScoreData {
  date: string;
  score: number;
  source: 'garmin' | 'polar' | 'healthkit';
}

interface UseSleepScoreHistoryReturn {
  sleepScores: SleepScoreData[];
  loading: boolean;
  error: string | null;
}

export const useSleepScoreHistory = (): UseSleepScoreHistoryReturn => {
  const [sleepScores, setSleepScores] = useState<SleepScoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchSleepScores = async () => {
      setLoading(true);
      setError(null);

      try {
        // Buscar dados do Garmin
        const { data: garminData, error: garminError } = await supabase
          .from('garmin_sleep_summaries')
          .select('calendar_date, sleep_score')
          .eq('user_id', user.id)
          .not('sleep_score', 'is', null)
          .order('calendar_date', { ascending: true });

        if (garminError) {
          console.error('Erro ao buscar dados Garmin:', garminError);
        }

        // Buscar dados do Polar
        const { data: polarData, error: polarError } = await supabase
          .from('polar_sleep')
          .select('date, sleep_score')
          .eq('user_id', user.id)
          .not('sleep_score', 'is', null)
          .order('date', { ascending: true });

        if (polarError) {
          console.error('Erro ao buscar dados Polar:', polarError);
        }

        // Buscar dados do HealthKit
        const { data: healthkitData, error: healthkitError } = await supabase
          .from('healthkit_sleep_summaries')
          .select('calendar_date, sleep_score')
          .eq('user_id', user.id)
          .not('sleep_score', 'is', null)
          .order('calendar_date', { ascending: true });

        if (healthkitError) {
          console.error('Erro ao buscar dados HealthKit:', healthkitError);
        }

        // Unificar os dados
        const unifiedData: SleepScoreData[] = [];

        if (garminData) {
          garminData.forEach(item => {
            unifiedData.push({
              date: item.calendar_date,
              score: item.sleep_score,
              source: 'garmin'
            });
          });
        }

        if (polarData) {
          polarData.forEach(item => {
            unifiedData.push({
              date: item.date,
              score: item.sleep_score,
              source: 'polar'
            });
          });
        }

        if (healthkitData) {
          healthkitData.forEach(item => {
            unifiedData.push({
              date: item.calendar_date,
              score: item.sleep_score,
              source: 'healthkit'
            });
          });
        }

        // Ordenar por data e remover duplicatas (prioridade: Garmin > Polar > HealthKit)
        const sortedData = unifiedData
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .reduce((acc, current) => {
            const existingIndex = acc.findIndex(item => item.date === current.date);
            if (existingIndex >= 0) {
              // Se já existe um registro para essa data, manter por prioridade
              const existing = acc[existingIndex];
              if (current.source === 'garmin') {
                acc[existingIndex] = current;
              } else if (current.source === 'polar' && existing.source === 'healthkit') {
                acc[existingIndex] = current;
              }
            } else {
              acc.push(current);
            }
            return acc;
          }, [] as SleepScoreData[]);

        setSleepScores(sortedData);
      } catch (err) {
        console.error('Erro ao buscar histórico de sono:', err);
        setError('Erro ao carregar dados de sono');
      } finally {
        setLoading(false);
      }
    };

    fetchSleepScores();
  }, [user]);

  return {
    sleepScores,
    loading,
    error
  };
};