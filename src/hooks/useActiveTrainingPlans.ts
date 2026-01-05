import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Cache constants
const PLANS_CACHE_KEY = 'training_plans_cache_v1';
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

interface CachedPlansData {
  mainPlan: TrainingPlan | null;
  strengthPlan: TrainingPlan | null;
  workouts: TrainingWorkout[];
  timestamp: number;
  userId: string;
}

// Cache functions
const getCachedPlans = (userId: string): Omit<CachedPlansData, 'timestamp' | 'userId'> | null => {
  try {
    const raw = localStorage.getItem(PLANS_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedPlansData = JSON.parse(raw);
    
    // Check user match and expiration
    if (cached.userId !== userId) return null;
    if (Date.now() - cached.timestamp > CACHE_DURATION) return null;
    
    return {
      mainPlan: cached.mainPlan,
      strengthPlan: cached.strengthPlan,
      workouts: cached.workouts,
    };
  } catch {
    return null;
  }
};

const setCachedPlans = (data: Omit<CachedPlansData, 'timestamp'>) => {
  try {
    const payload: CachedPlansData = {
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem(PLANS_CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to cache plans:', err);
  }
};

export const clearPlansCache = () => {
  try {
    localStorage.removeItem(PLANS_CACHE_KEY);
  } catch {}
};

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
  rescheduleWorkout: (workoutId: string, newDate: string, strategy: 'swap' | 'replace' | 'push') => Promise<void>;
  hasStrengthPlan: boolean;
  canAddStrengthPlan: boolean;
}

export const useActiveTrainingPlans = (): UseActiveTrainingPlansReturn => {
  const { user } = useAuth();
  const initializedRef = useRef(false);
  
  // Initialize state from cache if available
  const getInitialState = () => {
    if (!user?.id) return { mainPlan: null, strengthPlan: null, workouts: [] };
    const cached = getCachedPlans(user.id);
    return cached || { mainPlan: null, strengthPlan: null, workouts: [] };
  };
  
  const [mainPlan, setMainPlan] = useState<TrainingPlan | null>(() => getInitialState().mainPlan);
  const [strengthPlan, setStrengthPlan] = useState<TrainingPlan | null>(() => getInitialState().strengthPlan);
  const [workouts, setWorkouts] = useState<TrainingWorkout[]>(() => getInitialState().workouts);
  const [loading, setLoading] = useState(() => {
    // Only show loading if no cache
    if (!user?.id) return false;
    return !getCachedPlans(user.id);
  });
  const [error, setError] = useState<string | null>(null);

  const fetchActivePlans = async (showLoading = true) => {
    if (!user) return;

    // Only show loading spinner if no cached data
    const cached = getCachedPlans(user.id);
    if (showLoading && !cached) {
      setLoading(true);
    }
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
      let fetchedWorkouts: TrainingWorkout[] = [];
      if (plans.length > 0) {
        const planIds = plans.map(p => p.id);
        const { data: workoutsData, error: workoutsError } = await supabase
          .from('training_plan_workouts')
          .select('*')
          .in('plan_id', planIds)
          .order('workout_date', { ascending: true });

        if (workoutsError) throw workoutsError;
        fetchedWorkouts = workoutsData || [];
        setWorkouts(fetchedWorkouts);
      } else {
        setWorkouts([]);
      }

      // Update cache
      setCachedPlans({
        mainPlan: main,
        strengthPlan: strength,
        workouts: fetchedWorkouts,
        userId: user.id,
      });
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

      setWorkouts(prev => {
        const updated = prev.map(w => 
          w.id === workoutId 
            ? { ...w, status: 'completed', completed_activity_id: activityId, completed_activity_source: activitySource }
            : w
        );
        // Update cache with new workouts
        if (user) {
          setCachedPlans({ mainPlan, strengthPlan, workouts: updated, userId: user.id });
        }
        return updated;
      });

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

      setWorkouts(prev => {
        const updated = prev.map(w => 
          w.id === workoutId 
            ? { ...w, status: 'planned', completed_activity_id: null, completed_activity_source: null }
            : w
        );
        // Update cache with new workouts
        if (user) {
          setCachedPlans({ mainPlan, strengthPlan, workouts: updated, userId: user.id });
        }
        return updated;
      });

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

      // Update local state and clear cache
      clearPlansCache();
      
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

  const rescheduleWorkout = async (workoutId: string, newDate: string, strategy: 'swap' | 'replace' | 'push') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const response = await fetch(
        'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/reschedule-workout',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            workout_id: workoutId,
            new_date: newDate,
            strategy,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reschedule workout');
      }

      // Clear cache and refresh
      clearPlansCache();
      await fetchActivePlans();

      // Notify other parts of the app (other hook instances/pages) to refresh immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('training-workouts-changed'));
      }

      const todayKey = new Date().toISOString().slice(0, 10);
      localStorage.removeItem(`daily_briefing_${todayKey}`);
    } catch (err) {
      console.error('Error rescheduling workout:', err);
      setError(err instanceof Error ? err.message : 'Failed to reschedule workout');
      throw err;
    }
  };

  const refreshPlans = async () => {
    clearPlansCache();
    await fetchActivePlans();
  };

  // Initialize from cache when user changes
  useEffect(() => {
    if (!user?.id) {
      setMainPlan(null);
      setStrengthPlan(null);
      setWorkouts([]);
      setLoading(false);
      return;
    }
    
    // Try to load from cache first
    const cached = getCachedPlans(user.id);
    if (cached) {
      setMainPlan(cached.mainPlan);
      setStrengthPlan(cached.strengthPlan);
      setWorkouts(cached.workouts);
      setLoading(false);
      // Background refresh
      fetchActivePlans(false);
    } else {
      fetchActivePlans(true);
    }
  }, [user?.id]);

  // Local event bus: ensure other screens/widgets refresh immediately after reschedule
  useEffect(() => {
    if (!user) return;

    const handler = () => {
      fetchActivePlans();
    };

    window.addEventListener('training-workouts-changed', handler as EventListener);
    return () => window.removeEventListener('training-workouts-changed', handler as EventListener);
  }, [user?.id]);

  // Realtime subscription for workout changes (reschedule, completion, etc.)
  useEffect(() => {
    if (!user) return;

    console.log('🔄 Setting up realtime listener for workouts');

    const channel = supabase
      .channel(`training-workouts-realtime:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_plan_workouts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔄 Realtime workout change detected:', payload);

          if (payload.eventType === 'UPDATE') {
            const updatedWorkout = payload.new as TrainingWorkout;
            setWorkouts((prev) => prev.map((w) => (w.id === updatedWorkout.id ? updatedWorkout : w)));
          } else if (payload.eventType === 'INSERT') {
            const newWorkout = payload.new as TrainingWorkout;
            setWorkouts((prev) => [...prev, newWorkout]);
          } else if (payload.eventType === 'DELETE') {
            const deletedWorkout = payload.old as TrainingWorkout;
            setWorkouts((prev) => prev.filter((w) => w.id !== deletedWorkout.id));
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up realtime listener');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

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
    rescheduleWorkout,
    hasStrengthPlan,
    canAddStrengthPlan,
  };
};
