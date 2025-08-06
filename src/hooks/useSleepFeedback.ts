import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SleepAnalysisData, OvertrainingAnalysisData } from './useSleepAIAnalysis';

export interface SleepFeedbackAnalysis {
  id: string;
  analysis_text: string;
  sleep_data: SleepAnalysisData;
  overtraining_data: OvertrainingAnalysisData;
  created_at: string;
}

interface UseSleepFeedbackReturn {
  savedFeedbacks: SleepFeedbackAnalysis[];
  loading: boolean;
  error: string | null;
  saveFeedback: (analysis: string, sleepData: SleepAnalysisData, overtrainingData: OvertrainingAnalysisData) => Promise<void>;
  loadFeedbacks: () => Promise<void>;
  deleteFeedback: (id: string) => Promise<void>;
}

export const useSleepFeedback = (): UseSleepFeedbackReturn => {
  const [savedFeedbacks, setSavedFeedbacks] = useState<SleepFeedbackAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const saveFeedback = async (analysis: string, sleepData: SleepAnalysisData, overtrainingData: OvertrainingAnalysisData) => {
    if (!user) {
      setError('Usuário não autenticado');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('💾 Sleep Feedback: Saving analysis');

      const { data, error: saveError } = await supabase
        .from('sleep_feedback_analysis')
        .insert({
          user_id: user.id,
          analysis_text: analysis,
          sleep_data: sleepData as any,
          overtraining_data: overtrainingData as any
        })
        .select()
        .single();

      if (saveError) {
        console.error('Save error:', saveError);
        throw new Error(saveError.message || 'Falha ao salvar feedback');
      }

      console.log('💾 Sleep Feedback: Analysis saved successfully');
      
      // Add to local state
      setSavedFeedbacks(prev => [data as any, ...prev]);
    } catch (err) {
      console.error('Sleep Feedback save error:', err);
      setError(err instanceof Error ? err.message : 'Falha ao salvar feedback');
    } finally {
      setLoading(false);
    }
  };

  const loadFeedbacks = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: loadError } = await supabase
        .from('sleep_feedback_analysis')
        .select('*')
        .order('created_at', { ascending: false });

      if (loadError) {
        console.error('Load error:', loadError);
        throw new Error(loadError.message || 'Falha ao carregar feedbacks');
      }

      setSavedFeedbacks((data as any) || []);
    } catch (err) {
      console.error('Sleep Feedback load error:', err);
      setError(err instanceof Error ? err.message : 'Falha ao carregar feedbacks');
    } finally {
      setLoading(false);
    }
  };

  const deleteFeedback = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('sleep_feedback_analysis')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw new Error(deleteError.message || 'Falha ao deletar feedback');
      }

      // Remove from local state
      setSavedFeedbacks(prev => prev.filter(feedback => feedback.id !== id));
    } catch (err) {
      console.error('Sleep Feedback delete error:', err);
      setError(err instanceof Error ? err.message : 'Falha ao deletar feedback');
    } finally {
      setLoading(false);
    }
  };

  return {
    savedFeedbacks,
    loading,
    error,
    saveFeedback,
    loadFeedbacks,
    deleteFeedback,
  };
};