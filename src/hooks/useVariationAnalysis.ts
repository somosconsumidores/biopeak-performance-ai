import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { UnifiedActivity } from './useUnifiedActivityHistory';

interface VariationAnalysisResult {
  paceCV: number;
  heartRateCV: number;
  paceCVCategory: 'Baixo' | 'Alto';
  heartRateCVCategory: 'Baixo' | 'Alto';
  diagnosis: string;
  hasValidData: boolean;
  dataPoints: number;
}

export function useVariationAnalysis(activity: UnifiedActivity | null) {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<VariationAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NEW: Fallback to HealthKit raw data for native apps
  const fetchHealthKitRawData = async (activityId: string): Promise<{ heartRates: number[], paces: number[] } | null> => {
    try {
      console.log('🔍 [Variation] Fetching HealthKit raw data for activity:', activityId);
      
      const { data: rawData, error } = await supabase
        .from('healthkit_raw_workout_data')
        .select('heart_rate_data, distance_data, duration_seconds')
        .eq('healthkit_uuid', activityId)
        .single();

      if (error || !rawData) {
        console.log('❌ [Variation] No HealthKit raw data found:', error?.message);
        return null;
      }

      const heartRates: number[] = [];
      const paces: number[] = [];

      // Extract heart rate data
      if (rawData.heart_rate_data && Array.isArray(rawData.heart_rate_data)) {
        rawData.heart_rate_data.forEach((hrPoint: any) => {
          if (hrPoint.value && hrPoint.value > 0) {
            heartRates.push(hrPoint.value);
          }
        });
      }

      // Calculate pace from distance data
      if (rawData.distance_data && Array.isArray(rawData.distance_data) && rawData.duration_seconds) {
        const totalDistance = rawData.distance_data.reduce((sum: number, point: any) => sum + (point.value || 0), 0);
        if (totalDistance > 0) {
          const avgPaceMinPerKm = (rawData.duration_seconds / 60) / (totalDistance / 1000);
          // Create synthetic pace data points
          for (let i = 0; i < Math.min(heartRates.length, 100); i++) {
            paces.push(avgPaceMinPerKm);
          }
        }
      }

      console.log(`✅ [Variation] HealthKit raw data: ${heartRates.length} HR, ${paces.length} pace samples`);
      return heartRates.length >= 10 ? { heartRates, paces } : null;
    } catch (err) {
      console.error('❌ [Variation] Error fetching HealthKit raw data:', err);
      return null;
    }
  };

  // NEW: Fetch from activity_chart_data (prioritized for Garmin and Strava)
  const fetchFromActivityChartData = async (activityId: string): Promise<{ heartRates: number[], paces: number[] } | null> => {
    try {
      console.log('🔍 [Variation] Fetching from activity_chart_data for activity:', activityId);
      console.log('🔍 [Variation] Platform info:', {
        platform: window.navigator?.platform,
        isNative: (window as any).Capacitor?.isNativePlatform?.(),
        userAgent: window.navigator?.userAgent
      });
      
      // Add retry logic specifically for native platforms
      const maxRetries = (window as any).Capacitor?.isNativePlatform?.() ? 5 : 3;
      let lastError: any = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔍 [Variation] Attempt ${attempt}/${maxRetries} to fetch activity_chart_data`);
          
          const { data: chartData, error } = await supabase
            .from('activity_chart_data')
            .select('series_data, activity_source, data_points_count')
            .eq('activity_id', activityId)
            .single();

          if (error) {
            console.log(`❌ [Variation] No data in activity_chart_data (attempt ${attempt}):`, error.message);
            lastError = error;
            
            // If it's an auth error, wait longer before retry
            if (error.message?.includes('JWT') || error.message?.includes('auth')) {
              console.log('🔍 [Variation] Auth error detected, waiting longer before retry...');
              await new Promise(resolve => setTimeout(resolve, attempt * 2000));
              continue;
            }
            
            // For non-auth errors, fail fast on first attempt
            if (attempt === 1) {
              return null;
            }
            continue;
          }

          if (!chartData || !chartData.series_data || !Array.isArray(chartData.series_data)) {
            console.log('❌ [Variation] Invalid series_data in activity_chart_data');
            return null;
          }

          console.log(`✅ [Variation] Found ${chartData.data_points_count} data points from activity_chart_data (${chartData.activity_source})`);

          const heartRates: number[] = [];
          const paces: number[] = [];

          chartData.series_data.forEach((point: any) => {
            // Extract heart rate
            const hr = point.heart_rate || point.hr || 0;
            if (hr > 0) {
              heartRates.push(hr);
            }

            // Extract pace
            let pace = null;
            if (point.pace_min_km !== undefined && point.pace_min_km > 0) {
              pace = point.pace_min_km;
            } else if (point.speed_ms !== undefined && point.speed_ms > 0) {
              pace = (1000 / point.speed_ms) / 60;
            }

            if (pace && pace > 0) {
              paces.push(pace);
            }
          });

          console.log(`✅ [Variation] Extracted ${heartRates.length} HR samples, ${paces.length} pace samples`);
          
          return heartRates.length >= 10 || paces.length >= 10 ? { heartRates, paces } : null;
          
        } catch (attemptError) {
          console.error(`❌ [Variation] Error on attempt ${attempt}:`, attemptError);
          lastError = attemptError;
          
          if (attempt < maxRetries) {
            const backoffDelay = attempt * 1000;
            console.log(`🔍 [Variation] Waiting ${backoffDelay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }
        }
      }
      
      console.error('❌ [Variation] All attempts failed, last error:', lastError);
      return null;
    } catch (err) {
      console.error('❌ [Variation] Error fetching from activity_chart_data:', err);
      return null;
    }
  };

  const calculateVariationCoefficients = async () => {
    if (!user || !activity) {
      setAnalysis(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Helper: stratified uniform sampling across the whole activity
    const stratifiedSample = <T,>(arr: T[], target: number): T[] => {
      if (!Array.isArray(arr) || arr.length <= target) return arr.slice();
      const result: T[] = [];
      const n = target;
      const len = arr.length;
      const bucketSize = len / n;
      for (let i = 0; i < n; i++) {
        const start = Math.floor(i * bucketSize);
        const end = Math.min(len - 1, Math.floor((i + 1) * bucketSize) - 1);
        if (end < start) continue;
        // pick middle index for stability
        const mid = Math.floor((start + end) / 2);
        result.push(arr[mid]);
      }
      return result;
    };

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        let heartRates: number[] = [];
        let paces: number[] = [];

        // PRIORITY 1: Try activity_chart_data for Garmin, Strava, and HealthKit
        if (activity.source === 'GARMIN' || activity.source === 'STRAVA' || activity.source === 'HEALTHKIT') {
          console.log(`🔍 [Variation] Trying activity_chart_data for ${activity.source} activity ${activity.activity_id} (attempt ${attempt})`);
          console.log('🔍 [Variation] Auth status:', {
            hasUser: !!user,
            userId: user?.id?.substring(0, 8) + '...',
            isNative: (window as any).Capacitor?.isNativePlatform?.()
          });
          
          const chartDataResult = await fetchFromActivityChartData(activity.activity_id);
          if (chartDataResult) {
            heartRates = chartDataResult.heartRates;
            paces = chartDataResult.paces;
            console.log(`✅ [Variation] Using activity_chart_data: ${heartRates.length} HR, ${paces.length} pace samples`);
          } else {
            console.log(`❌ [Variation] No chart data available for ${activity.source} activity ${activity.activity_id}`);
            
            // For HealthKit on native, try to use raw HealthKit data as fallback
            if (activity.source === 'HEALTHKIT' && (window as any).Capacitor?.isNativePlatform?.()) {
              console.log('🔍 [Variation] Trying HealthKit raw data fallback...');
              const healthkitFallback = await fetchHealthKitRawData(activity.activity_id);
              if (healthkitFallback) {
                heartRates = healthkitFallback.heartRates;
                paces = healthkitFallback.paces;
                console.log(`✅ [Variation] Using HealthKit raw data: ${heartRates.length} HR, ${paces.length} pace samples`);
              }
            }
          }
        }

        // FALLBACK: Use legacy data sources for other sources or if chart data not available
        if (heartRates.length < 10 && paces.length < 10) {
          console.log(`🔍 [Variation] Fallback to legacy sources for ${activity.source} activity ${activity.activity_id} (attempt ${attempt})`);
          console.log('🔍 [Variation] Current data state:', {
            heartRatesCount: heartRates.length,
            pacesCount: paces.length,
            source: activity.source,
            isNative: (window as any).Capacitor?.isNativePlatform?.()
          });
          
          let activityDetails: any[] = [];
          let detailsError: any = null;

          if (activity.source === 'GARMIN') {
            // No fallback - activity_chart_data should be available for all Garmin activities
            console.log('❌ [Variation] No data in activity_chart_data for Garmin activity - this should not happen');
            activityDetails = [];
            detailsError = null;
          } else if (activity.source === 'STRAVA' && activity.device_name === 'Strava GPX') {
            const result = await supabase
              .from('strava_gpx_activity_details')
              .select('heart_rate, speed_meters_per_second, total_distance_in_meters, sample_timestamp')
              .eq('activity_id', activity.activity_id)
              .not('heart_rate', 'is', null)
              .not('total_distance_in_meters', 'is', null)
              .gt('heart_rate', 0)
              .order('sample_timestamp', { ascending: true });

            let rawDetails = result.data || [];
            detailsError = result.error;

            // Calcular velocidade a partir da distância e tempo se não estiver disponível
            if (rawDetails.length > 1) {
              for (let i = 1; i < rawDetails.length; i++) {
                const prev = rawDetails[i - 1];
                const cur = rawDetails[i];
                const tPrev = new Date(prev.sample_timestamp).getTime();
                const tCur = new Date(cur.sample_timestamp).getTime();
                const dt = (tCur - tPrev) / 1000; // segundos
                const dPrev = Number(prev.total_distance_in_meters || 0);
                const dCur = Number(cur.total_distance_in_meters || 0);
                const dd = dCur - dPrev;
                const speed = dt > 0 && dd >= 0 ? dd / dt : 0;

                if (!cur.speed_meters_per_second || cur.speed_meters_per_second <= 0) {
                  cur.speed_meters_per_second = speed;
                }
              }
            }

            activityDetails = rawDetails;
          } else if (activity.source === 'STRAVA' && activity.device_name === 'STRAVA') {
            // No fallback - activity_chart_data should be available for all Strava activities
            console.log('❌ [Variation] No data in activity_chart_data for Strava activity - this should not happen');
            activityDetails = [];
            detailsError = null;
          } else if (activity.source === 'ZEPP') {
            const result = await supabase
              .from('zepp_gpx_activity_details')
              .select('heart_rate, speed_meters_per_second, total_distance_in_meters, sample_timestamp')
              .eq('activity_id', activity.activity_id)
              .not('heart_rate', 'is', null)
              .not('total_distance_in_meters', 'is', null)
              .gt('heart_rate', 0)
              .order('sample_timestamp', { ascending: true });

            let rawDetails = result.data || [];
            detailsError = result.error;

            if (rawDetails.length > 1) {
              for (let i = 1; i < rawDetails.length; i++) {
                const prev = rawDetails[i - 1];
                const cur = rawDetails[i];
                const tPrev = new Date(prev.sample_timestamp).getTime();
                const tCur = new Date(cur.sample_timestamp).getTime();
                const dt = (tCur - tPrev) / 1000; // segundos
                const dPrev = Number(prev.total_distance_in_meters || 0);
                const dCur = Number(cur.total_distance_in_meters || 0);
                const dd = dCur - dPrev;
                const speed = dt > 0 && dd >= 0 ? dd / dt : 0;

                if (!cur.speed_meters_per_second || cur.speed_meters_per_second <= 0) {
                  cur.speed_meters_per_second = speed;
                }
              }
            }

            activityDetails = rawDetails;
          } else if (activity.source === 'POLAR') {
            const result = await supabase
              .from('polar_activity_details')
              .select('heart_rate, speed_meters_per_second, sample_timestamp')
              .eq('user_id', user.id)
              .eq('activity_id', activity.activity_id)
              .not('heart_rate', 'is', null)
              .not('speed_meters_per_second', 'is', null)
              .gt('heart_rate', 0)
              .gt('speed_meters_per_second', 0)
              .order('sample_timestamp', { ascending: true });

            activityDetails = result.data || [];
            detailsError = result.error;
          } else {
            throw new Error(`Fonte de atividade não suportada: ${activity.source}`);
          }

          if (detailsError) {
            console.error('🔍 Erro na busca de detalhes:', detailsError);
            throw new Error(`Erro ao buscar detalhes: ${detailsError.message || detailsError}`);
          }

          if (!activityDetails || activityDetails.length < 10) {
            setAnalysis({
              paceCV: 0,
              heartRateCV: 0,
              paceCVCategory: 'Baixo',
              heartRateCVCategory: 'Baixo',
              diagnosis: 'Dados insuficientes para análise (mínimo 10 pontos)',
              hasValidData: false,
              dataPoints: activityDetails?.length || 0
            });
            setLoading(false);
            return;
          }

          // Amostragem estratificada para representar toda a atividade
          const sampledData = stratifiedSample(activityDetails, 300);

          // Extrair dados de FC e converter velocidade para pace usando dados amostrados
          heartRates = sampledData
            .map(d => d.heart_rate)
            .filter((hr: number | null | undefined) => typeof hr === 'number' && hr > 0) as number[];

          // Verificar quantos registros têm dados de velocidade válidos
          const recordsWithSpeed = sampledData.filter(d =>
            d.speed_meters_per_second &&
            d.speed_meters_per_second > 0 &&
            !isNaN(d.speed_meters_per_second)
          );

          // Calcular paces (min/km)
          if (recordsWithSpeed.length >= 10) {
            paces = recordsWithSpeed
              .map(d => 1000 / (d.speed_meters_per_second * 60));
          } else {
            const allSpeedRecords = sampledData.filter(d =>
              d.speed_meters_per_second !== null &&
              d.speed_meters_per_second !== undefined &&
              !isNaN(d.speed_meters_per_second)
            );
            if (allSpeedRecords.length >= 10) {
              paces = allSpeedRecords
                .map(d => {
                  const speed = d.speed_meters_per_second || 0.1;
                  return speed > 0 ? 1000 / (speed * 60) : 60;
                });
            }
          }
        }

        if (paces.length < 10 || heartRates.length < 10) {
          setAnalysis({
            paceCV: 0,
            heartRateCV: 0,
            paceCVCategory: 'Baixo',
            heartRateCVCategory: 'Baixo',
            diagnosis: `Dados de velocidade/FC insuficientes para análise robusta`,
            hasValidData: false,
            dataPoints: heartRates.length + paces.length
          });
          setLoading(false);
          return;
        }

        // Calcular médias
        const avgHeartRate = heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length;
        const avgPace = paces.reduce((sum, pace) => sum + pace, 0) / paces.length;

        // Calcular desvios padrão
        const hrVariance = heartRates.reduce((sum, hr) => sum + Math.pow(hr - avgHeartRate, 2), 0) / heartRates.length;
        const paceVariance = paces.reduce((sum, pace) => sum + Math.pow(pace - avgPace, 2), 0) / paces.length;

        const hrStdDev = Math.sqrt(hrVariance);
        const paceStdDev = Math.sqrt(paceVariance);

        // Calcular coeficientes de variação
        const heartRateCV = hrStdDev / avgHeartRate;
        const paceCV = paceStdDev / avgPace;

        // Categorizar CVs
        const heartRateCVCategory: 'Baixo' | 'Alto' = heartRateCV <= 0.15 ? 'Baixo' : 'Alto';
        const paceCVCategory: 'Baixo' | 'Alto' = paceCV <= 0.15 ? 'Baixo' : 'Alto';

        // Determinar diagnóstico
        let diagnosis = '';
        if (heartRateCVCategory === 'Baixo' && paceCVCategory === 'Baixo') {
          diagnosis = 'Ritmo e esforço constantes → treino contínuo e controlado';
        } else if (heartRateCVCategory === 'Baixo' && paceCVCategory === 'Alto') {
          diagnosis = 'Ritmo variando mas esforço cardiovascular constante → você ajustou o pace para manter FC estável (estratégia eficiente em provas longas)';
        } else if (heartRateCVCategory === 'Alto' && paceCVCategory === 'Baixo') {
          diagnosis = 'Ritmo constante mas FC variando → possível fadiga, desidratação, temperatura alta ou pouca adaptação ao esforço';
        } else {
          diagnosis = 'Ritmo e esforço muito variáveis → treino intervalado, fartlek, ou atividade desorganizada';
        }

        setAnalysis({
          paceCV,
          heartRateCV,
          paceCVCategory,
          heartRateCVCategory,
          diagnosis,
          hasValidData: true,
          dataPoints: heartRates.length + paces.length
        });

        setLoading(false);
        return; // sucesso, sai do laço de retry
      } catch (err) {
        console.error(`Erro ao calcular análise de variação (tentativa ${attempt}):`, err);
        if (attempt === MAX_RETRIES) {
          setError(err instanceof Error ? err.message : 'Erro desconhecido');
          setLoading(false);
          return;
        }
        // backoff exponencial curto
        const delay = 300 * Math.pow(2, attempt - 1);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  };

  useEffect(() => {
    calculateVariationCoefficients();
  }, [user, activity]);

  const refetch = () => {
    calculateVariationCoefficients();
  };

  return {
    analysis,
    loading,
    error,
    refetch
  };
}