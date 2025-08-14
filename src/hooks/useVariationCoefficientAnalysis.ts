import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CVAnalysis {
  heartRateCV: number | null;
  paceCV: number | null;
  heartRateCVLevel: 'Baixo' | 'Alto' | null;
  paceCVLevel: 'Baixo' | 'Alto' | null;
  diagnosis: string | null;
}

interface UseVariationCoefficientAnalysisReturn {
  analysis: CVAnalysis | null;
  loading: boolean;
  error: string | null;
}

export const useVariationCoefficientAnalysis = (activityId?: string): UseVariationCoefficientAnalysisReturn => {
  const [analysis, setAnalysis] = useState<CVAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!activityId || !user) {
      setAnalysis(null);
      return;
    }

    const fetchCVAnalysis = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch statistics metrics for the activity
        const { data: statsData, error: statsError } = await supabase
          .from('statistics_metrics')
          .select('heart_rate_cv_percent, pace_cv_percent')
          .eq('user_id', user.id)
          .eq('activity_id', activityId)
          .maybeSingle();

        if (statsError) {
          console.error('Error fetching statistics metrics:', statsError);
          setError('Erro ao buscar métricas estatísticas');
          return;
        }

        if (!statsData) {
          console.log('No statistics metrics found for activity:', activityId);
          setAnalysis(null);
          return;
        }

        const heartRateCV = statsData.heart_rate_cv_percent;
        const paceCV = statsData.pace_cv_percent;

        // Calculate CV levels and diagnosis
        const cvAnalysis = calculateCVAnalysis(heartRateCV, paceCV);
        setAnalysis(cvAnalysis);

      } catch (err) {
        console.error('Error in CV analysis:', err);
        setError('Erro ao analisar coeficientes de variação');
      } finally {
        setLoading(false);
      }
    };

    fetchCVAnalysis();
  }, [activityId, user]);

  return { analysis, loading, error };
};

function calculateCVAnalysis(heartRateCV: number | null, paceCV: number | null): CVAnalysis {
  // Determine CV levels (≤0.15 = Baixo, >0.15 = Alto)
  const heartRateCVLevel = heartRateCV !== null 
    ? (heartRateCV <= 15 ? 'Baixo' : 'Alto') 
    : null;
  
  const paceCVLevel = paceCV !== null 
    ? (paceCV <= 15 ? 'Baixo' : 'Alto') 
    : null;

  // Generate diagnosis based on combinations
  let diagnosis: string | null = null;

  if (heartRateCVLevel && paceCVLevel) {
    if (heartRateCVLevel === 'Baixo' && paceCVLevel === 'Baixo') {
      diagnosis = "Ritmo e esforço constantes → treino contínuo e controlado";
    } else if (heartRateCVLevel === 'Baixo' && paceCVLevel === 'Alto') {
      diagnosis = "Ritmo variando mas esforço cardiovascular constante → você ajustou o pace para manter FC estável (estratégia eficiente em provas longas)";
    } else if (heartRateCVLevel === 'Alto' && paceCVLevel === 'Baixo') {
      diagnosis = "Ritmo constante mas FC variando → possível fadiga, desidratação, temperatura alta ou pouca adaptação ao esforço";
    } else if (heartRateCVLevel === 'Alto' && paceCVLevel === 'Alto') {
      diagnosis = "Ritmo e esforço muito variáveis → treino intervalado, fartlek, ou atividade desorganizada";
    }
  }

  return {
    heartRateCV,
    paceCV,
    heartRateCVLevel,
    paceCVLevel,
    diagnosis
  };
}