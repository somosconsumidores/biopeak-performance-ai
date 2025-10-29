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

      // Buscar o garmin_user_id do usuário
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

      // Buscar os 2 últimos registros válidos de VO2 Max
      // Priorizando running, mas considerando cycling se running for null
      const { data: vo2MaxRecords, error: vo2Error } = await supabase
        .from('garmin_vo2max')
        .select('vo2_max_running, vo2_max_cycling, calendar_date')
        .eq('garmin_user_id', garminUserId)
        .or('vo2_max_running.gt.0,vo2_max_cycling.gt.0')
        .order('calendar_date', { ascending: false })
        .limit(2);

      if (vo2Error) throw vo2Error;

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

      // Extrair valores válidos (priorizar running sobre cycling)
      const validRecords = vo2MaxRecords.map(record => ({
        vo2Value: Number(record.vo2_max_running || record.vo2_max_cycling),
        calendar_date: record.calendar_date
      }));

      const currentVo2Max = validRecords[0].vo2Value;
      const lastRecordDate = new Date(validRecords[0].calendar_date).toLocaleDateString('pt-BR');
      const previousVo2Max = validRecords.length > 1 ? validRecords[1].vo2Value : null;

      // Calcular mudança e tendência
      let change = 0;
      let trend: 'up' | 'down' | 'stable' = 'stable';

      if (currentVo2Max && previousVo2Max) {
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
        change: Math.round(change * 10) / 10,
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