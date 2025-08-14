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

  useEffect(() => {
    if (!user || !activity) {
      setAnalysis(null);
      return;
    }

    const calculateVariationCoefficients = async () => {
      setLoading(true);
      setError(null);

      try {
        let activityDetails: any[] = [];
        let detailsError: any = null;

        // Determinar qual tabela usar baseado na fonte da atividade
        if (activity.source === 'GARMIN') {
          const result = await supabase
            .from('garmin_activity_details')
            .select('heart_rate, speed_meters_per_second, sample_timestamp')
            .eq('user_id', user.id)
            .eq('activity_id', activity.activity_id)
            .not('heart_rate', 'is', null)
            .not('speed_meters_per_second', 'is', null)
            .gt('heart_rate', 0)
            .gt('speed_meters_per_second', 0)
            .order('sample_timestamp', { ascending: true })
            .limit(1000);
          
          activityDetails = result.data || [];
          detailsError = result.error;
        } else if (activity.source === 'STRAVA') {
          // Strava GPX usa a tabela strava_gpx_activity_details
          // Buscar dados incluindo total_distance_in_meters para calcular velocidade
          const result = await supabase
            .from('strava_gpx_activity_details')
            .select('heart_rate, speed_meters_per_second, total_distance_in_meters, sample_timestamp')
            .eq('activity_id', activity.activity_id)
            .not('heart_rate', 'is', null)
            .not('total_distance_in_meters', 'is', null)
            .gt('heart_rate', 0)
            .order('sample_timestamp', { ascending: true })
            .limit(1000);
          
          let rawDetails = result.data || [];
          detailsError = result.error;
          
          // Calcular velocidade a partir da distância e tempo se não estiver disponível
          if (rawDetails.length > 1) {
            console.log('🔍 Debug - Calculando velocidades para dados GPX Strava');
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
        } else if (activity.source === 'ZEPP') {
          // Zepp GPX usa a tabela zepp_gpx_activity_details
          // Buscar dados incluindo total_distance_in_meters para calcular velocidade
          const result = await supabase
            .from('zepp_gpx_activity_details')
            .select('heart_rate, speed_meters_per_second, total_distance_in_meters, sample_timestamp')
            .eq('activity_id', activity.activity_id)
            .not('heart_rate', 'is', null)
            .not('total_distance_in_meters', 'is', null)
            .gt('heart_rate', 0)
            .order('sample_timestamp', { ascending: true })
            .limit(1000);
          
          let rawDetails = result.data || [];
          detailsError = result.error;
          
          // Calcular velocidade a partir da distância e tempo se não estiver disponível
          if (rawDetails.length > 1) {
            console.log('🔍 Debug - Calculando velocidades para dados GPX Zepp');
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
            .order('sample_timestamp', { ascending: true })
            .limit(1000);
          
          activityDetails = result.data || [];
          detailsError = result.error;
        } else {
          throw new Error(`Fonte de atividade não suportada: ${activity.source}`);
        }

        if (detailsError) {
          console.error('🔍 Erro na busca de detalhes:', detailsError);
          throw new Error(`Erro ao buscar detalhes: ${detailsError.message}`);
        }

        console.log(`🔍 Análise CV: Atividade ${activity.source}, dados encontrados: ${activityDetails?.length || 0}`);

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
          return;
        }

        // Fazer amostragem uniforme para melhorar performance mantendo representatividade
        let sampledData = activityDetails;
        if (activityDetails.length > 300) {
          // Calcular step para distribuir uniformemente ao longo da atividade
          const step = Math.floor(activityDetails.length / 300);
          sampledData = activityDetails.filter((_, index) => index % step === 0);
          
          console.log(`🔍 Análise CV: Dados originais: ${activityDetails.length}, após amostragem: ${sampledData.length}`);
        }

        // Extrair dados de FC e converter velocidade para pace usando dados amostrados
        const heartRates = sampledData.map(d => d.heart_rate);
        
        // Verificar quantos registros têm dados de velocidade válidos
        const recordsWithSpeed = sampledData.filter(d => 
          d.speed_meters_per_second && 
          d.speed_meters_per_second > 0 && 
          !isNaN(d.speed_meters_per_second)
        );
        
        console.log(`🔍 Debug - Total de registros: ${sampledData.length}, com velocidade: ${recordsWithSpeed.length}`);
        
        // Se temos poucos dados de velocidade, relaxar os critérios
        let paces: number[] = [];
        if (recordsWithSpeed.length >= 10) {
          paces = recordsWithSpeed.map(d => 1000 / (d.speed_meters_per_second * 60)); // min/km
        } else {
          // Tentar incluir registros com velocidade mesmo que seja 0 ou muito baixa
          const allSpeedRecords = sampledData.filter(d => 
            d.speed_meters_per_second !== null && 
            d.speed_meters_per_second !== undefined &&
            !isNaN(d.speed_meters_per_second)
          );
          
          if (allSpeedRecords.length >= 10) {
            paces = allSpeedRecords.map(d => {
              const speed = d.speed_meters_per_second || 0.1; // Evitar divisão por zero
              return speed > 0 ? 1000 / (speed * 60) : 60; // 60 min/km como fallback
            });
          }
        }
        
        console.log(`🔍 Debug - Dados de pace calculados: ${paces.length} pontos`);
        
        // Se ainda não há dados de pace suficientes, mostrar apenas análise de FC
        if (paces.length < 10) {
          setAnalysis({
            paceCV: 0,
            heartRateCV: 0,
            paceCVCategory: 'Baixo',
            heartRateCVCategory: 'Baixo',
            diagnosis: `Dados de velocidade insuficientes (${recordsWithSpeed.length} registros com velocidade válida) - análise de variação requer dados de pace e frequência cardíaca`,
            hasValidData: false,
            dataPoints: activityDetails.length
          });
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
          dataPoints: activityDetails.length
        });

      } catch (err) {
        console.error('Erro ao calcular análise de variação:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    calculateVariationCoefficients();
  }, [user, activity]);

  return {
    analysis,
    loading,
    error
  };
}