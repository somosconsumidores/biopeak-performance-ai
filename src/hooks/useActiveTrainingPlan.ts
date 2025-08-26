import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TrainingPlan {
  id: string;
  plan_name: string;
  goal_type: string;
  start_date: string;
  end_date: string;
  weeks: number;
  status: string;
  target_event_date?: string;
  created_at: string;
}

export interface TrainingWorkout {
  id: string;
  plan_id: string;
  week_number: number;
  day_of_week: number;
  workout_type: string;
  workout_name: string;
  description: string;
  duration_minutes?: number;
  distance_km?: number;
  target_pace_min_km?: number;
  target_heart_rate_zone?: string;
  instructions: string;
  is_completed: boolean;
  completed_at?: string;
  scheduled_date: string;
}

interface UseActiveTrainingPlanReturn {
  plan: TrainingPlan | null;
  workouts: TrainingWorkout[];
  loading: boolean;
  error: string | null;
  refreshPlan: () => Promise<void>;
  completeWorkout: (workoutId: string) => Promise<void>;
  uncompleteWorkout: (workoutId: string) => Promise<void>;
}

export const useActiveTrainingPlan = (): UseActiveTrainingPlanReturn => {
  const { user } = useAuth();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [workouts, setWorkouts] = useState<TrainingWorkout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivePlan = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch active training plan
      const { data: planData, error: planError } = await supabase
        .from('training_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (planError && planError.code !== 'PGRST116') {
        throw planError;
      }

      setPlan(planData);

      if (planData) {
        // Fetch workouts for the active plan
        const { data: workoutsData, error: workoutsError } = await supabase
          .from('training_plan_workouts')
          .select('*')
          .eq('plan_id', planData.id)
          .order('week_number', { ascending: true })
          .order('day_of_week', { ascending: true });

        if (workoutsError) {
          throw workoutsError;
        }

        setWorkouts(workoutsData || []);
      } else {
        setWorkouts([]);
      }
    } catch (err) {
      console.error('Error fetching active training plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch training plan');
    } finally {
      setLoading(false);
    }
  };

  const completeWorkout = async (workoutId: string) => {
    try {
      const { error } = await supabase
        .from('training_plan_workouts')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', workoutId);

      if (error) throw error;

      setWorkouts(prev => prev.map(w => 
        w.id === workoutId 
          ? { ...w, is_completed: true, completed_at: new Date().toISOString() }
          : w
      ));
    } catch (err) {
      console.error('Error completing workout:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete workout');
    }
  };

  const uncompleteWorkout = async (workoutId: string) => {
    try {
      const { error } = await supabase
        .from('training_plan_workouts')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', workoutId);

      if (error) throw error;

      setWorkouts(prev => prev.map(w => 
        w.id === workoutId 
          ? { ...w, is_completed: false, completed_at: undefined }
          : w
      ));
    } catch (err) {
      console.error('Error uncompleting workout:', err);
      setError(err instanceof Error ? err.message : 'Failed to uncomplete workout');
    }
  };

  const refreshPlan = async () => {
    await fetchActivePlan();
  };

  useEffect(() => {
    fetchActivePlan();
  }, [user]);

  return {
    plan,
    workouts,
    loading,
    error,
    refreshPlan,
    completeWorkout,
    uncompleteWorkout,
  };
};