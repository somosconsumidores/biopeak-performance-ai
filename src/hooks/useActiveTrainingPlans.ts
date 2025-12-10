import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TrainingPlan {
  id: string;
  plan_name: string;
  goal_type: string;
  sport_type: string;
  start_date: string;
  end_date: string;
  weeks: number;
  status: string;
  target_event_date?: string;
  target_time_minutes_min?: number;
  target_time_minutes_max?: number;
  created_at: string;
  is_complementary?: boolean;
  parent_plan_id?: string;
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

interface UseActiveTrainingPlansReturn {
  mainPlan: TrainingPlan | null;
  strengthPlan: TrainingPlan | null;
  allPlans: TrainingPlan[];
  workouts: TrainingWorkout[];
  mainWorkouts: TrainingWorkout[];
  strengthWorkouts: TrainingWorkout[];
  loading: boolean;
  error: string | null;
  refreshPlans: () => Promise<void>;
  markWorkoutCompleted: (workoutId: string, activityId?: string, activitySource?: string) => Promise<void>;
  markWorkoutPlanned: (workoutId: string) => Promise<void>;
  deletePlan: (planId: string) => Promise<void>;
  hasStrengthPlan: boolean;
  canAddStrengthPlan: boolean;
}

export const useActiveTrainingPlans = (): UseActiveTrainingPlansReturn => {
  const { user } = useAuth();
  const [mainPlan, setMainPlan] = useState<TrainingPlan | null>(null);
  const [strengthPlan, setStrengthPlan] = useState<TrainingPlan | null>(null);
  const [workouts, setWorkouts] = useState<TrainingWorkout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivePlans = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all active training plans (max 2: main + strength)
      const { data: plansData, error: plansError } = await supabase
        .from('training_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (plansError) throw plansError;

      const plans = plansData || [];
      
      // Separate main plan from strength plan
      const main = plans.find(p => !p.is_complementary && p.sport_type !== 'strength') || null;
      const strength = plans.find(p => p.is_complementary || p.sport_type === 'strength') || null;

      // Clear briefing cache if plans changed
      if (main && (!mainPlan || main.id !== mainPlan.id)) {
        const todayKey = new Date().toISOString().slice(0, 10);
        localStorage.removeItem(`daily_briefing_${todayKey}`);
      }

      setMainPlan(main);
      setStrengthPlan(strength);

      // Fetch workouts for all active plans
      if (plans.length > 0) {
        const planIds = plans.map(p => p.id);
        const { data: workoutsData, error: workoutsError } = await supabase
          .from('training_plan_workouts')
          .select('*')
          .in('plan_id', planIds)
          .order('workout_date', { ascending: true });

        if (workoutsError) throw workoutsError;
        setWorkouts(workoutsData || []);
      } else {
        setWorkouts([]);
      }
    } catch (err) {
      console.error('Error fetching active training plans:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch training plans');
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

      const todayKey = new Date().toISOString().slice(0, 10);
      localStorage.removeItem(`daily_briefing_${todayKey}`);
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

      const todayKey = new Date().toISOString().slice(0, 10);
      localStorage.removeItem(`daily_briefing_${todayKey}`);
    } catch (err) {
      console.error('Error marking workout as planned:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark workout as planned');
    }
  };

  const deletePlan = async (planId: string) => {
    try {
      const { error } = await supabase
        .from('training_plans')
        .update({ status: 'cancelled' })
        .eq('id', planId);

      if (error) throw error;

      const todayKey = new Date().toISOString().slice(0, 10);
      localStorage.removeItem(`daily_briefing_${todayKey}`);

      // Update local state
      if (mainPlan?.id === planId) {
        setMainPlan(null);
        setWorkouts(prev => prev.filter(w => w.plan_id !== planId));
      }
      if (strengthPlan?.id === planId) {
        setStrengthPlan(null);
        setWorkouts(prev => prev.filter(w => w.plan_id !== planId));
      }
    } catch (err) {
      console.error('Error cancelling plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel plan');
    }
  };

  const refreshPlans = async () => {
    await fetchActivePlans();
  };

  useEffect(() => {
    fetchActivePlans();
  }, [user]);

  // Listen to realtime updates for training_plan_workouts
  useEffect(() => {
    if (!mainPlan && !strengthPlan) return;

    const planIds = [mainPlan?.id, strengthPlan?.id].filter(Boolean) as string[];
    if (planIds.length === 0) return;

    console.log('🔄 Setting up realtime listener for workouts (multiple plans)');
    
    const channel = supabase
      .channel('training_plan_workouts_multi')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_plan_workouts',
        },
        (payload) => {
          const workout = (payload.new || payload.old) as TrainingWorkout;
          if (!planIds.includes(workout.plan_id)) return;

          console.log('🔄 Realtime workout update:', payload);
          
          if (payload.eventType === 'UPDATE') {
            const updatedWorkout = payload.new as TrainingWorkout;
            setWorkouts(prev => prev.map(w => 
              w.id === updatedWorkout.id ? updatedWorkout : w
            ));
          } else if (payload.eventType === 'INSERT') {
            const newWorkout = payload.new as TrainingWorkout;
            setWorkouts(prev => [...prev, newWorkout]);
          } else if (payload.eventType === 'DELETE') {
            const deletedWorkout = payload.old as TrainingWorkout;
            setWorkouts(prev => prev.filter(w => w.id !== deletedWorkout.id));
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up realtime listener');
      supabase.removeChannel(channel);
    };
  }, [mainPlan?.id, strengthPlan?.id]);

  // Derived values
  const allPlans = [mainPlan, strengthPlan].filter(Boolean) as TrainingPlan[];
  const mainWorkouts = workouts.filter(w => mainPlan && w.plan_id === mainPlan.id);
  const strengthWorkouts = workouts.filter(w => strengthPlan && w.plan_id === strengthPlan.id);
  const hasStrengthPlan = !!strengthPlan;
  const canAddStrengthPlan = !!mainPlan && !strengthPlan;

  return {
    mainPlan,
    strengthPlan,
    allPlans,
    workouts,
    mainWorkouts,
    strengthWorkouts,
    loading,
    error,
    refreshPlans,
    markWorkoutCompleted,
    markWorkoutPlanned,
    deletePlan,
    hasStrengthPlan,
    canAddStrengthPlan,
  };
};
