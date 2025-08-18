import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface GarminVo2MaxData {
  currentVo2Max: number | null;
  previousVo2Max: number | null;
  change: number;
  trend: 'up' | 'down' | 'stable';
  lastRecordDate: string | null;
  loading: boolean;
  error: string | null;
}

export function useGarminVo2Max(): GarminVo2MaxData {
  const [data, setData] = useState<GarminVo2MaxData>({
    currentVo2Max: null,
    previousVo2Max: null,
    change: 0,
    trend: 'stable',
    lastRecordDate: null,
    loading: true,
    error: null
  });
  
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    fetchGarminVo2Max();
  }, [user]);

  const fetchGarminVo2Max = async () => {
    if (!user) return;

    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      // Primeiro buscar o garmin_user_id do usuário
      const { data: tokens, error: tokenError } = await supabase
        .from('garmin_tokens')
        .select('garmin_user_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      if (tokenError || !tokens?.length || !tokens[0].garmin_user_id) {
        setData({
          currentVo2Max: null,
          previousVo2Max: null,
          change: 0,
          trend: 'stable',
          lastRecordDate: null,
          loading: false,
          error: null
        });
        return;
      }

      const garminUserId = tokens[0].garmin_user_id;

      // Buscar os últimos registros de VO2Max do Garmin
      const { data: vo2MaxRecords, error: vo2Error } = await supabase
        .from('garmin_vo2max')
        .select('vo2_max_running, vo2_max_cycling, calendar_date')
        .eq('garmin_user_id', garminUserId)
        .order('calendar_date', { ascending: false })
        .limit(20); // Pegar os últimos 20 registros para ter chance de encontrar valores não-nulos

      if (vo2Error) {
        throw vo2Error;
      }

      let currentVo2Max = null;
      let previousVo2Max = null;
      let lastRecordDate = null;

      // Encontrar o último valor não-nulo (priorizar running, depois cycling)
      for (const record of vo2MaxRecords || []) {
        const vo2Value = record.vo2_max_running ?? record.vo2_max_cycling;
        if (vo2Value !== null && vo2Value !== undefined && currentVo2Max === null) {
          currentVo2Max = Number(vo2Value);
          lastRecordDate = new Date(record.calendar_date).toLocaleDateString('pt-BR');
        } else if (vo2Value !== null && vo2Value !== undefined && previousVo2Max === null && currentVo2Max !== null) {
          previousVo2Max = Number(vo2Value);
          break; // Temos ambos os valores, podemos parar
        }
      }

      // Calcular mudança e tendência
      let change = 0;
      let trend: 'up' | 'down' | 'stable' = 'stable';

      if (currentVo2Max !== null && previousVo2Max !== null) {
        change = ((currentVo2Max - previousVo2Max) / previousVo2Max) * 100;
        if (Math.abs(change) < 1) {
          trend = 'stable';
        } else if (change > 0) {
          trend = 'up';
        } else {
          trend = 'down';
        }
      }

      setData({
        currentVo2Max,
        previousVo2Max,
        change: Math.round(change * 10) / 10, // Arredondar para 1 casa decimal
        trend,
        lastRecordDate,
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('Error fetching Garmin VO2Max:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar dados de VO2Max'
      }));
    }
  };

  return data;
}