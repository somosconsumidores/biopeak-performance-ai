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
        let activityDetails: any[] = [];
        let detailsError: any = null;

        // Determinar qual tabela usar baseado na fonte da atividade
        if (activity.source === 'GARMIN') {
          console.log(`🔍 Análise CV GARMIN: Buscando dados para atividade ${activity.activity_id} (tentativa ${attempt})`);

          // Buscar todos os pontos necessários; amostrar client-side para representatividade
          const result = await supabase
            .from('garmin_activity_details')
            .select('heart_rate, speed_meters_per_second, sample_timestamp')
            .eq('user_id', user.id)
            .eq('activity_id', activity.activity_id)
            .not('heart_rate', 'is', null)
            .gt('heart_rate', 0)
            .order('sample_timestamp', { ascending: true });

          activityDetails = result.data || [];
          detailsError = result.error;
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
          const result = await supabase
            .from('strava_activity_details')
            .select('heartrate, velocity_smooth, time_seconds')
            .eq('user_id', user.id)
            .eq('strava_activity_id', parseInt(activity.strava_activity_id?.toString() || activity.activity_id))
            .not('heartrate', 'is', null)
            .gt('heartrate', 0)
            .order('time_seconds', { ascending: true });

          let rawDetails = result.data || [];
          detailsError = result.error;

          // Converter para formato padrão
          activityDetails = rawDetails.map(d => ({
            heart_rate: d.heartrate,
            speed_meters_per_second: d.velocity_smooth || null,
            sample_timestamp: d.time_seconds
          }));
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
        const heartRates = sampledData
          .map(d => d.heart_rate)
          .filter((hr: number | null | undefined) => typeof hr === 'number' && hr > 0) as number[];

        // Verificar quantos registros têm dados de velocidade válidos
        const recordsWithSpeed = sampledData.filter(d =>
          d.speed_meters_per_second &&
          d.speed_meters_per_second > 0 &&
          !isNaN(d.speed_meters_per_second)
        );

        // Calcular paces (min/km)
        let paces: number[] = [];
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

        if (paces.length < 10 || heartRates.length < 10) {
          setAnalysis({
            paceCV: 0,
            heartRateCV: 0,
            paceCVCategory: 'Baixo',
            heartRateCVCategory: 'Baixo',
            diagnosis: `Dados de velocidade/FC insuficientes para análise robusta`,
            hasValidData: false,
            dataPoints: sampledData.length
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
          dataPoints: sampledData.length
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