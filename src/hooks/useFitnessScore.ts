import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface FitnessScore {
  fitness_score: number;
  capacity_score: number;
  consistency_score: number;
  recovery_balance_score: number;
  daily_strain: number;
  atl_7day: number;
  ctl_42day: number;
  calendar_date: string;
}

interface FitnessScoreHistory {
  date: string;
  score: number;
}

export const useFitnessScore = () => {
  const [currentScore, setCurrentScore] = useState<FitnessScore | null>(null);
  const [scoreHistory, setScoreHistory] = useState<FitnessScoreHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchFitnessScores = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Get current score (most recent)
      const { data: currentData, error: currentError } = await supabase
        .from('fitness_scores_daily')
        .select('*')
        .eq('user_id', user.id)
        .order('calendar_date', { ascending: false })
        .limit(1);

      if (currentError) {
        console.error('Error fetching current fitness score:', currentError);
        throw currentError;
      }

      if (currentData && currentData.length > 0) {
        setCurrentScore(currentData[0]);
      }

      // Get last 30 days for history
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: historyData, error: historyError } = await supabase
        .from('fitness_scores_daily')
        .select('calendar_date, fitness_score')
        .eq('user_id', user.id)
        .gte('calendar_date', startDate)
        .order('calendar_date', { ascending: true });

      if (historyError) {
        console.error('Error fetching fitness score history:', historyError);
        throw historyError;
      }

      if (historyData) {
        const history = historyData.map(item => ({
          date: item.calendar_date,
          score: item.fitness_score
        }));
        setScoreHistory(history);
      }

    } catch (err) {
      console.error('Error in fetchFitnessScores:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch fitness scores');
    } finally {
      setLoading(false);
    }
  };

  const calculateFitnessScore = async (targetDate?: string) => {
    if (!user) return false;

    try {
      setError(null);
      
      const { data, error: functionError } = await supabase.functions.invoke('calculate-fitness-score', {
        body: {
          user_id: user.id,
          target_date: targetDate
        }
      });

      if (functionError) {
        console.error('Error calculating fitness score:', functionError);
        throw functionError;
      }

      console.log('✅ Fitness score calculated successfully:', data);
      
      // Refresh the data
      await fetchFitnessScores();
      
      return true;
    } catch (err) {
      console.error('Error in calculateFitnessScore:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate fitness score');
      return false;
    }
  };

  const getScoreTrend = () => {
    if (scoreHistory.length < 2) return { change: 0, trend: 'stable' as const };
    
    const latest = scoreHistory[scoreHistory.length - 1]?.score || 0;
    const previous = scoreHistory[scoreHistory.length - 2]?.score || 0;
    const change = latest - previous;
    
    return {
      change: Math.round(change * 100) / 100,
      trend: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'stable' as const
    };
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return { label: 'Elite', color: 'text-emerald-600' };
    if (score >= 70) return { label: 'Excelente', color: 'text-green-600' };
    if (score >= 55) return { label: 'Bom', color: 'text-blue-600' };
    if (score >= 40) return { label: 'Regular', color: 'text-yellow-600' };
    return { label: 'Baixo', color: 'text-red-600' };
  };

  useEffect(() => {
    fetchFitnessScores();
  }, [user]);

  return {
    currentScore,
    scoreHistory,
    loading,
    error,
    calculateFitnessScore,
    refetchScores: fetchFitnessScores,
    getScoreTrend,
    getScoreLabel
  };
};