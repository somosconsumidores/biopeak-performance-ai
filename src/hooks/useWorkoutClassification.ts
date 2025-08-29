import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface WorkoutClassification {
  id: string;
  user_id: string;
  activity_id: string;
  detected_workout_type: string;
  metrics: {
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export const useWorkoutClassification = (activityId: string | null) => {
  const { user } = useAuth();
  const [classification, setClassification] = useState<WorkoutClassification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activityId || !user) {
      setClassification(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchClassification = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('workout_classification')
          .select('*')
          .eq('activity_id', activityId)
          .eq('user_id', user.id)
          .single();

        if (queryError) {
          if (queryError.code === 'PGRST116') {
            // No data found
            setClassification(null);
          } else {
            throw queryError;
          }
        } else {
          setClassification(data);
        }
      } catch (err) {
        console.error('Error fetching workout classification:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar classificação');
      } finally {
        setLoading(false);
      }
    };

    fetchClassification();
  }, [activityId, user]);

  return { classification, loading, error };
};