import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface VariationAnalysisResult {
  paceCV: number;
  heartRateCV: number;
  paceCVCategory: 'Baixo' | 'Alto';
  heartRateCVCategory: 'Baixo' | 'Alto';
  diagnosis: string;
  hasValidData: boolean;
  dataPoints: number;
}

export function useVariationAnalysis(activityId: string | null) {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<VariationAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !activityId) {
      setAnalysis(null);
      return;
    }

    const calculateVariationCoefficients = async () => {
      setLoading(true);
      setError(null);

      try {
        // Buscar detalhes da atividade
        const { data: activityDetails, error: detailsError } = await supabase
          .from('garmin_activity_details')
          .select('heart_rate, speed_meters_per_second')
          .eq('user_id', user.id)
          .eq('activity_id', activityId)
          .not('heart_rate', 'is', null)
          .not('speed_meters_per_second', 'is', null)
          .gt('heart_rate', 0)
          .gt('speed_meters_per_second', 0);

        if (detailsError) {
          throw new Error(`Erro ao buscar detalhes: ${detailsError.message}`);
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
          return;
        }

        // Extrair dados de FC e converter velocidade para pace
        const heartRates = activityDetails.map(d => d.heart_rate);
        const paces = activityDetails.map(d => 1000 / (d.speed_meters_per_second * 60)); // min/km

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
  }, [user, activityId]);

  return {
    analysis,
    loading,
    error
  };
}