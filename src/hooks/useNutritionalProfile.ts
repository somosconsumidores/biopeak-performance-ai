import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  birth_date: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  gender?: string | null;
}

interface NutritionalProfile {
  bmr: number;
  tdee: number;
  avgTrainingCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  age: number;
  weight: number;
  height: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
}

interface NutritionPlan {
  id: string;
  insight_type: string;
  insight_data: {
    goal?: string;
    breakfast?: string;
    lunch?: string;
    pre_workout?: string;
    dinner?: string;
    snacks?: string;
    notes?: string;
    created_at?: string;
  };
  created_at: string;
}

export function useNutritionalProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [avgDailyCalories, setAvgDailyCalories] = useState<number>(0);
  const [nutritionPlan, setNutritionPlan] = useState<NutritionPlan | null>(null);
  const [tomorrowWorkout, setTomorrowWorkout] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    try {
      setProfileLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Check if user has required metabolic data
  const hasMetabolicData = useMemo(() => {
    if (!profile) return false;
    return (
      profile.weight_kg !== null &&
      profile.height_cm !== null &&
      profile.birth_date !== null
    );
  }, [profile]);

  // Calculate age from birth date
  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Calculate BMR using Mifflin-St Jeor equation
  const calculateBMR = (weight: number, height: number, age: number, gender: 'male' | 'female' = 'male'): number => {
    if (gender === 'male') {
      return 10 * weight + 6.25 * height - 5 * age + 5;
    }
    return 10 * weight + 6.25 * height - 5 * age - 161;
  };

  // Fetch average daily training calories from last 30 days
  useEffect(() => {
    const fetchActivityData = async () => {
      if (!user) return;

      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data, error } = await supabase
          .from('all_activities')
          .select('active_kilocalories, activity_date')
          .eq('user_id', user.id)
          .gte('activity_date', thirtyDaysAgo.toISOString().split('T')[0]);

        if (error) throw error;

        if (data && data.length > 0) {
          const totalCalories = data.reduce((sum, activity) => {
            return sum + (activity.active_kilocalories || 0);
          }, 0);
          setAvgDailyCalories(Math.round(totalCalories / 30));
        }
      } catch (error) {
        console.error('Error fetching activity data:', error);
      }
    };

    fetchActivityData();
  }, [user]);

  // Fetch nutrition plan from ai_coach_insights_history
  useEffect(() => {
    const fetchNutritionPlan = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('ai_coach_insights_history')
          .select('*')
          .eq('user_id', user.id)
          .eq('insight_type', 'nutrition_plan')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setNutritionPlan(data as NutritionPlan);
        }
      } catch (error) {
        console.error('Error fetching nutrition plan:', error);
      }
    };

    fetchNutritionPlan();
  }, [user]);

  // Fetch tomorrow's workout for tactical suggestions
  useEffect(() => {
    const fetchTomorrowWorkout = async () => {
      if (!user) return;

      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('training_plan_workouts')
          .select('*')
          .eq('user_id', user.id)
          .eq('workout_date', tomorrowStr)
          .maybeSingle();

        if (error) throw error;
        setTomorrowWorkout(data);
      } catch (error) {
        console.error('Error fetching tomorrow workout:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTomorrowWorkout();
  }, [user]);

  // Calculate complete nutritional profile
  const nutritionalProfile = useMemo((): NutritionalProfile | null => {
    if (!profile || !hasMetabolicData) return null;

    const weight = profile.weight_kg!;
    const height = profile.height_cm!;
    const age = calculateAge(profile.birth_date!);
    
    // Use gender from profile if available
    const gender = (profile.gender === 'female' ? 'female' : 'male') as 'male' | 'female';
    const bmr = calculateBMR(weight, height, age, gender);
    
    // Determine activity level based on training frequency
    let activityMultiplier = 1.55;
    let activityLevel: NutritionalProfile['activityLevel'] = 'moderate';
    
    if (avgDailyCalories > 500) {
      activityMultiplier = 1.9;
      activityLevel = 'very_active';
    } else if (avgDailyCalories > 300) {
      activityMultiplier = 1.725;
      activityLevel = 'active';
    } else if (avgDailyCalories > 150) {
      activityMultiplier = 1.55;
      activityLevel = 'moderate';
    }

    const tdee = Math.round(bmr * activityMultiplier);

    // Macro distribution for performance athletes
    const proteinGrams = Math.round(weight * 1.8);
    const carbsGrams = Math.round(weight * 5.5);
    const proteinCalories = proteinGrams * 4;
    const carbsCalories = carbsGrams * 4;
    const fatCalories = Math.max(tdee - proteinCalories - carbsCalories, tdee * 0.2);
    const fatGrams = Math.round(fatCalories / 9);

    return {
      bmr: Math.round(bmr),
      tdee,
      avgTrainingCalories: avgDailyCalories,
      proteinGrams,
      carbsGrams,
      fatGrams,
      age,
      weight,
      height,
      activityLevel,
    };
  }, [profile, hasMetabolicData, avgDailyCalories]);

  return {
    profile,
    nutritionalProfile,
    nutritionPlan,
    tomorrowWorkout,
    hasMetabolicData,
    loading: loading || profileLoading,
    refetchProfile: fetchProfile,
  };
}
