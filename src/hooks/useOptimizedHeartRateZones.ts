import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface HeartRateZone {
  zone: string;
  label: string;
  min: number;
  max: number;
  timeInZone: number;
  percentage: number;
  color: string;
}

export const useOptimizedHeartRateZones = (activityId: string | null) => {
  const { user } = useAuth();
  const [zones, setZones] = useState<HeartRateZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);

  const calculateZones = async (id: string) => {
    if (!user) return;

    setLoading(true);
    setError(null);
    setZones([]);
    setHasData(false);

    try {
      console.log('Fetching optimized HR zones for activity:', id);

      // First get the activity source from all_activities table
      const { data: activityData } = await supabase
        .from('all_activities')
        .select('activity_source')
        .eq('user_id', user.id)
        .eq('activity_id', id)
        .maybeSingle();

      const activitySource = activityData?.activity_source || 'garmin';
      console.log('Activity source detected:', activitySource);

      // Buscar dados otimizados da tabela activity_heart_rate_zones
      const { data: zoneData, error: zoneError } = await supabase
        .from('activity_heart_rate_zones')
        .select('*')
        .eq('user_id', user.id)
        .eq('activity_id', id)
        .eq('activity_source', activitySource)
        .maybeSingle();

      if (zoneError) {
        console.error('Error fetching HR zones:', zoneError);
        setError('Erro ao buscar zonas de frequência cardíaca');
        return;
      }

      if (!zoneData) {
        console.log('No optimized HR zones found, triggering ETL processing...');
        
        // Tentar processar via ETL
        try {
          const { error: etlError } = await supabase.functions.invoke('process-activity-data-etl', {
            body: { 
              user_id: user.id,
              activity_id: id,
              activity_source: activitySource
            }
          });

          if (etlError) {
            console.error('ETL processing error:', etlError);
            setError('Erro ao processar dados da atividade');
            return;
          }

          // Tentar buscar novamente após ETL
          const { data: newZoneData } = await supabase
            .from('activity_heart_rate_zones')
            .select('*')
            .eq('user_id', user.id)
            .eq('activity_id', id)
            .eq('activity_source', activitySource)
            .maybeSingle();

          if (!newZoneData) {
            setError('Dados de frequência cardíaca não disponíveis');
            return;
          }

          // Usar os novos dados
          buildZones(newZoneData);
        } catch (etlError) {
          console.error('Error in ETL processing:', etlError);
          setError('Erro ao processar dados da atividade');
        }
      } else {
        // Usar dados existentes
        buildZones(zoneData);
      }

    } catch (error) {
      console.error('Error calculating HR zones:', error);
      setError('Erro ao calcular zonas de frequência cardíaca');
    } finally {
      setLoading(false);
    }
  };

  const buildZones = (zoneData: any) => {
    const maxHR = zoneData.max_heart_rate;
    
    const zoneDefinitions = [
      { zone: 'Z1', label: 'Recuperação', min: 0.5, max: 0.6, color: '#22c55e' },
      { zone: 'Z2', label: 'Aeróbico', min: 0.6, max: 0.7, color: '#84cc16' },
      { zone: 'Z3', label: 'Limiar', min: 0.7, max: 0.8, color: '#eab308' },
      { zone: 'Z4', label: 'Anaeróbico', min: 0.8, max: 0.9, color: '#f97316' },
      { zone: 'Z5', label: 'Máximo', min: 0.9, max: 1.0, color: '#ef4444' }
    ];

    const zoneTimes = [
      zoneData.zone_1_time_seconds || 0,
      zoneData.zone_2_time_seconds || 0,
      zoneData.zone_3_time_seconds || 0,
      zoneData.zone_4_time_seconds || 0,
      zoneData.zone_5_time_seconds || 0
    ];

    const zonePercentages = [
      zoneData.zone_1_percentage || 0,
      zoneData.zone_2_percentage || 0,
      zoneData.zone_3_percentage || 0,
      zoneData.zone_4_percentage || 0,
      zoneData.zone_5_percentage || 0
    ];

    const calculatedZones: HeartRateZone[] = zoneDefinitions.map((def, index) => ({
      zone: def.zone,
      label: def.label,
      min: Math.round(maxHR * def.min),
      max: Math.round(maxHR * def.max),
      timeInZone: zoneTimes[index],
      percentage: Number(zonePercentages[index].toFixed(1)),
      color: def.color
    }));

    setZones(calculatedZones);
    setHasData(calculatedZones.some(zone => zone.timeInZone > 0));
  };

  useEffect(() => {
    if (user && activityId) {
      calculateZones(activityId);
    }
  }, [user, activityId]);

  const refetch = () => {
    if (activityId) {
      calculateZones(activityId);
    }
  };

  return { zones, loading, error, hasData, refetch };
};