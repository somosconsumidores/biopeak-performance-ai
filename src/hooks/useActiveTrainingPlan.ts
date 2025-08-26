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
  target_time_minutes_min?: number;
  target_time_minutes_max?: number;
  created_at: string;
}

export interface TrainingWorkout {
  id: string;
  plan_id: string;
  workout_type: string;
  title: string;
  description: string;
  duration_minutes?: number;
  distance_meters?: number;
  target_pace_min_km?: number;
  target_hr_zone?: string;
  workout_date: string;
  status: string;
  completed_activity_id?: string;
  completed_activity_source?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface UseActiveTrainingPlanReturn {
  plan: TrainingPlan | null;
  workouts: TrainingWorkout[];
  loading: boolean;
  error: string | null;
  refreshPlan: () => Promise<void>;
  markWorkoutCompleted: (workoutId: string, activityId?: string, activitySource?: string) => Promise<void>;
  markWorkoutPlanned: (workoutId: string) => Promise<void>;
  deletePlan: () => Promise<void>;
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
          .order('workout_date', { ascending: true });

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

  const markWorkoutCompleted = async (workoutId: string, activityId?: string, activitySource?: string) => {
    try {
      const { error } = await supabase
        .from('training_plan_workouts')
        .update({
          status: 'completed',
          completed_activity_id: activityId,
          completed_activity_source: activitySource
        })
        .eq('id', workoutId);

      if (error) throw error;

      setWorkouts(prev => prev.map(w => 
        w.id === workoutId 
          ? { ...w, status: 'completed', completed_activity_id: activityId, completed_activity_source: activitySource }
          : w
      ));
    } catch (err) {
      console.error('Error marking workout as completed:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark workout as completed');
    }
  };

  const markWorkoutPlanned = async (workoutId: string) => {
    try {
      const { error } = await supabase
        .from('training_plan_workouts')
        .update({
          status: 'planned',
          completed_activity_id: null,
          completed_activity_source: null
        })
        .eq('id', workoutId);

      if (error) throw error;

      setWorkouts(prev => prev.map(w => 
        w.id === workoutId 
          ? { ...w, status: 'planned', completed_activity_id: null, completed_activity_source: null }
          : w
      ));
    } catch (err) {
      console.error('Error marking workout as planned:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark workout as planned');
    }
  };

  const deletePlan = async () => {
    if (!plan) return;
    
    try {
      const { error } = await supabase
        .from('training_plans')
        .update({ status: 'cancelled' })
        .eq('id', plan.id);

      if (error) throw error;

      // Clear local state
      setPlan(null);
      setWorkouts([]);
    } catch (err) {
      console.error('Error cancelling plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel plan');
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
    markWorkoutCompleted,
    markWorkoutPlanned,
    deletePlan,
  };
};