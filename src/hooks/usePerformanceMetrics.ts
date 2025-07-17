import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PerformanceMetrics {
  efficiency: {
    powerPerBeat: string;
    distancePerMinute: string;
    comment: string;
  };
  pace: {
    averageSpeed: string;
    variationCoefficient: string;
    comment: string;
  };
  heartRate: {
    averageHR: string;
    relativeIntensity: string;
    relativeReserve: string;
    comment: string;
  };
  effortDistribution: {
    beginning: string;
    middle: string;
    end: string;
    comment: string;
  };
}

interface UsePerformanceMetricsReturn {
  metrics: PerformanceMetrics | null;
  loading: boolean;
  error: string | null;
}

export const usePerformanceMetrics = (activityId: string): UsePerformanceMetricsReturn => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear metrics when activityId changes to force fresh calculation
  useEffect(() => {
    console.log('🔄 CLEARING METRICS - Activity changed from previous to:', activityId);
    setMetrics(null);
    setError(null);
    setLoading(true); // Force loading state to trigger fresh calculation
  }, [activityId]);

  useEffect(() => {
    if (!activityId) {
      setMetrics(null);
      return;
    }

    const calculateMetrics = async () => {
      setLoading(true);
      setError(null);

      try {
        const timestamp = new Date().toISOString();
        console.log(`🔍 [${timestamp}] STARTING FRESH CALCULATION for activity:`, activityId);

        // Fetch activity data with detailed logging
        console.log('📋 SQL Query for activity:', `SELECT * FROM garmin_activities WHERE activity_id = '${activityId}'`);
        const { data: activity, error: activityError } = await supabase
          .from('garmin_activities')
          .select('*')
          .eq('activity_id', activityId)
          .single();

        if (activityError) throw activityError;
        if (!activity) throw new Error('Activity not found');

        // Fetch activity details for pace variation calculation and effort distribution
        console.log('📋 SQL Query for details:', `SELECT speed_meters_per_second, heart_rate, power_in_watts, sample_timestamp, clock_duration_in_seconds FROM garmin_activity_details WHERE activity_id = '${activityId}' AND heart_rate IS NOT NULL ORDER BY clock_duration_in_seconds ASC`);
        
        const { data: activityDetails, error: detailsError } = await supabase
          .from('garmin_activity_details')
          .select('speed_meters_per_second, heart_rate, power_in_watts, sample_timestamp, clock_duration_in_seconds')
          .eq('activity_id', activityId)
          .not('heart_rate', 'is', null)
          .order('clock_duration_in_seconds', { ascending: true });

        if (detailsError) throw detailsError;

        console.log('📊 Activity data:', {
          activity_id: activity.activity_id,
          duration_in_seconds: activity.duration_in_seconds,
          avg_hr: activity.average_heart_rate_in_beats_per_minute,
          max_hr: activity.max_heart_rate_in_beats_per_minute
        });
        
        console.log('📈 Activity details count:', activityDetails?.length || 0);
        if (activityDetails && activityDetails.length > 0) {
          console.log('📈 First detail sample:', activityDetails[0]);
          console.log('📈 Last detail sample:', activityDetails[activityDetails.length - 1]);
        }

        // Calculate metrics with forced recalculation indicator
        console.log('🧮 STARTING CALCULATION with fresh data...');
        const calculatedMetrics = calculatePerformanceMetrics(activity, activityDetails || []);
        
        console.log('✅ FINAL CALCULATED METRICS:', JSON.stringify(calculatedMetrics, null, 2));
        console.log('✅ FINAL EFFORT DISTRIBUTION:', calculatedMetrics.effortDistribution);
        
        // Force state update with timestamp to prevent cache issues
        const metricsWithTimestamp = {
          ...calculatedMetrics,
          _timestamp: Date.now(),
          _activityId: activityId,
          _cacheBreaker: Math.random() // Extra cache breaker
        };
        
        setMetrics(metricsWithTimestamp);

      } catch (err) {
        console.error('Error calculating performance metrics:', err);
        setError(err instanceof Error ? err.message : 'Erro ao calcular métricas');
      } finally {
        setLoading(false);
      }
    };

    calculateMetrics();
  }, [activityId]);

  return { metrics, loading, error };
};

function calculatePerformanceMetrics(activity: any, details: any[]): PerformanceMetrics {
  // 1. Eficiência
  const avgHR = activity.average_heart_rate_in_beats_per_minute;
  const distance = activity.distance_in_meters / 1000; // km
  const duration = activity.duration_in_seconds / 60; // minutes
  
  // Power per beat (usando dados detalhados se disponível)
  const avgPower = details.length > 0 
    ? details.filter(d => d.power_in_watts).reduce((sum, d) => sum + d.power_in_watts, 0) / details.filter(d => d.power_in_watts).length
    : null;
  
  const powerPerBeat = avgPower && avgHR 
    ? `${(avgPower / avgHR).toFixed(2)} W/bpm`
    : 'N/A';
  
  const distancePerMinute = distance && duration 
    ? `${(distance / duration).toFixed(3)} km/min`
    : 'N/A';

  // 2. Ritmo
  const avgSpeed = activity.average_speed_in_meters_per_second 
    ? `${(activity.average_speed_in_meters_per_second * 3.6).toFixed(1)} km/h`
    : 'N/A';
  
  // Coefficient of variation for pace
  let variationCoefficient = 'N/A';
  if (details.length > 0) {
    const speeds = details.filter(d => d.speed_meters_per_second).map(d => d.speed_meters_per_second);
    if (speeds.length > 1) {
      const mean = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
      const variance = speeds.reduce((sum, speed) => sum + Math.pow(speed - mean, 2), 0) / speeds.length;
      const stdDev = Math.sqrt(variance);
      const cv = (stdDev / mean) * 100;
      variationCoefficient = `${cv.toFixed(1)}%`;
    }
  }

  // 3. Frequência Cardíaca
  const avgHRDisplay = avgHR ? `${avgHR} bpm` : 'N/A';
  const maxHR = activity.max_heart_rate_in_beats_per_minute;
  
  // Assuming max theoretical HR = 220 - age (we'll use a default estimation)
  const theoreticalMaxHR = 190; // Default value since we don't have age
  const relativeIntensity = avgHR && theoreticalMaxHR 
    ? `${((avgHR / theoreticalMaxHR) * 100).toFixed(1)}%`
    : 'N/A';
  
  const relativeReserve = avgHR && maxHR 
    ? `${(((avgHR - 60) / (maxHR - 60)) * 100).toFixed(1)}%` // Using resting HR = 60 as default
    : 'N/A';

  // 4. Distribuição do Esforço - NOVA IMPLEMENTAÇÃO: Divisão por terços iguais de registros
  let beginning = 'N/A', middle = 'N/A', end = 'N/A';
  
  if (details.length > 0) {
    console.log('🔄 REWRITING EFFORT DISTRIBUTION - Using equal record thirds instead of time');
    
    // Filtrar APENAS dados com heart_rate válido (mesmo critério da SQL)
    const validDetails = details.filter(d => 
      d.heart_rate !== null && 
      d.heart_rate !== undefined
    );
    
    console.log('📊 Valid details with HR:', validDetails.length);
    
    if (validDetails.length >= 3) { // Precisamos de pelo menos 3 registros para dividir em terços
      // Ordenar por clock_duration_in_seconds (ascendente) - mesmo que a SQL
      const sortedDetails = [...validDetails].sort((a, b) => {
        const aDuration = a.clock_duration_in_seconds || 0;
        const bDuration = b.clock_duration_in_seconds || 0;
        return aDuration - bDuration;
      });
      
      // Dividir em terços IGUAIS por número de registros (não por tempo!)
      const totalRecords = sortedDetails.length;
      const thirdSize = Math.floor(totalRecords / 3);
      const remainder = totalRecords % 3;
      
      // Dividir os registros em 3 grupos iguais
      const firstThirdEnd = thirdSize + (remainder > 0 ? 1 : 0); // Primeiro terço pega 1 extra se sobrar
      const secondThirdEnd = firstThirdEnd + thirdSize + (remainder > 1 ? 1 : 0); // Segundo terço pega 1 extra se sobrar 2
      
      const beginningData = sortedDetails.slice(0, firstThirdEnd);
      const middleData = sortedDetails.slice(firstThirdEnd, secondThirdEnd);
      const endData = sortedDetails.slice(secondThirdEnd);
      
      console.log('🎯 NEW EFFORT DISTRIBUTION LOGIC:');
      console.log('  Total valid records:', totalRecords);
      console.log('  Third size (base):', thirdSize);
      console.log('  Remainder:', remainder);
      console.log('  Beginning records:', beginningData.length, '(indices 0-' + (firstThirdEnd-1) + ')');
      console.log('  Middle records:', middleData.length, '(indices ' + firstThirdEnd + '-' + (secondThirdEnd-1) + ')');
      console.log('  End records:', endData.length, '(indices ' + secondThirdEnd + '-' + (totalRecords-1) + ')');

      // Calcular média de FC para cada terço
      const beginningHR = beginningData.length > 0 
        ? beginningData.reduce((sum, d) => sum + d.heart_rate, 0) / beginningData.length 
        : 0;
      
      const middleHR = middleData.length > 0 
        ? middleData.reduce((sum, d) => sum + d.heart_rate, 0) / middleData.length 
        : 0;
      
      const endHR = endData.length > 0 
        ? endData.reduce((sum, d) => sum + d.heart_rate, 0) / endData.length 
        : 0;

      console.log('💓 NEW CALCULATED HEART RATES (should match SQL: 136, 140, 136):');
      console.log('  Beginning HR (raw):', beginningHR);
      console.log('  Middle HR (raw):', middleHR);
      console.log('  End HR (raw):', endHR);
      
      beginning = beginningHR > 0 ? `${Math.round(beginningHR)} bpm` : 'N/A';
      middle = middleHR > 0 ? `${Math.round(middleHR)} bpm` : 'N/A';
      end = endHR > 0 ? `${Math.round(endHR)} bpm` : 'N/A';

      console.log('💓 FINAL FORMATTED VALUES (should be 136, 140, 136):');
      console.log('  Beginning:', beginning);
      console.log('  Middle:', middle);
      console.log('  End:', end);
      
      // Extra validation log
      if (beginning === '136 bpm' && middle === '140 bpm' && end === '136 bpm') {
        console.log('✅ SUCCESS! Values match SQL query results!');
      } else {
        console.log('❌ WARNING! Values do not match expected SQL results (136, 140, 136)');
      }
    }
  }

  // Generate AI comments based on data
  const generateEfficiencyComment = () => {
    if (powerPerBeat === 'N/A') return 'Dados de potência não disponíveis para análise completa.';
    if (parseFloat(powerPerBeat) > 2) return 'Excelente eficiência na geração de potência por batimento cardíaco.';
    return 'Boa relação entre potência e frequência cardíaca, continue focando na técnica.';
  };

  const generatePaceComment = () => {
    if (variationCoefficient === 'N/A') return 'Mantenha um ritmo mais consistente durante o treino.';
    const cv = parseFloat(variationCoefficient);
    if (cv < 10) return 'Excelente consistência de ritmo ao longo do treino.';
    if (cv < 20) return 'Boa consistência de ritmo, com algumas variações naturais.';
    return 'Ritmo variado - típico de treinos intervalados ou terrenos desafiadores.';
  };

  const generateHRComment = () => {
    if (!avgHR) return 'Dados de frequência cardíaca não disponíveis.';
    const intensity = parseFloat(relativeIntensity);
    if (intensity > 85) return 'Treino de alta intensidade - excelente para desenvolvimento cardiovascular.';
    if (intensity > 70) return 'Intensidade moderada-alta, ideal para melhorar condicionamento.';
    return 'Intensidade moderada, perfeita para treinos base e recuperação ativa.';
  };

  const generateEffortComment = () => {
    if (beginning === 'N/A') return 'Mantenha um aquecimento adequado e finalize com intensidade controlada.';
    const beginHR = parseInt(beginning);
    const endHR = parseInt(end);
    if (endHR > beginHR + 10) return 'Progressão positiva do esforço - terminou forte!';
    if (endHR < beginHR - 10) return 'Desaceleração natural - bom controle do esforço final.';
    return 'Distribuição equilibrada do esforço ao longo do treino.';
  };

  return {
    efficiency: {
      powerPerBeat,
      distancePerMinute,
      comment: generateEfficiencyComment()
    },
    pace: {
      averageSpeed: avgSpeed,
      variationCoefficient,
      comment: generatePaceComment()
    },
    heartRate: {
      averageHR: avgHRDisplay,
      relativeIntensity,
      relativeReserve,
      comment: generateHRComment()
    },
    effortDistribution: {
      beginning,
      middle,
      end,
      comment: generateEffortComment()
    }
  };
}