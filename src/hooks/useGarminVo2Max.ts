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
        .limit(50); // Aumentar limite para garantir que encontremos valores não-nulos

      if (vo2Error) {
        throw vo2Error;
      }

      if (!vo2MaxRecords || vo2MaxRecords.length === 0) {
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

      // Filtrar apenas registros com valores não-nulos
      // vo2_max_running é int4 no banco, então pode vir como number ou string
      const validRecords = vo2MaxRecords
        .filter(record => {
          const runningValue = record.vo2_max_running;
          const cyclingValue = record.vo2_max_cycling;
          
          // Verificar se algum dos valores é válido (não-nulo e não-zero)
          const hasValidRunning = runningValue !== null && runningValue !== undefined && runningValue > 0;
          const hasValidCycling = cyclingValue !== null && cyclingValue !== undefined && Number(cyclingValue) > 0;
          
          return hasValidRunning || hasValidCycling;
        })
        .map(record => {
          // Priorizar running (que é int4), depois cycling (que é numeric)
          const vo2Value = record.vo2_max_running || Number(record.vo2_max_cycling);
          return {
            ...record,
            vo2Value: Number(vo2Value)
          };
        });

      if (validRecords.length === 0) {
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

      // Pegar o primeiro (mais recente) valor válido como atual
      const currentRecord = validRecords[0];
      const currentVo2Max = currentRecord.vo2Value;
      const lastRecordDate = new Date(currentRecord.calendar_date).toLocaleDateString('pt-BR');

      // Pegar o segundo valor válido como anterior (se existir)
      const previousVo2Max = validRecords.length > 1 ? validRecords[1].vo2Value : null;

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