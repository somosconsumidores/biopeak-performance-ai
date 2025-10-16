import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface OnboardingData {
  goal: string;
  goal_other?: string;
  birth_date?: string;
  weight_kg?: number;
  athletic_level: string;
  phone?: string;
}

export interface UserOnboarding {
  id: string;
  user_id: string;
  goal: string;
  goal_other: string | null;
  birth_date: string | null;
  weight_kg: number | null;
  athletic_level: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export const useOnboarding = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [onboardingData, setOnboardingData] = useState<UserOnboarding | null>(null);
  const [localOnboardingCompleted, setLocalOnboardingCompleted] = useState<boolean | null>(null);

  const fetchOnboardingData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching onboarding data:', error);
        return;
      }

      setOnboardingData(data);
    } catch (error) {
      console.error('Error fetching onboarding data:', error);
    }
  };

  const saveOnboardingData = async (data: OnboardingData) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    console.log('🔍 ONBOARDING: Starting save process', { userId: user.id, data });
    console.log('🔍 ONBOARDING: Data validation', {
      hasGoal: !!data.goal,
      hasAthleticLevel: !!data.athletic_level,
      phone: data.phone || 'not provided'
    });
    
    try {
      // Save onboarding data (excluding phone which goes to profiles)
      const { phone: _, ...onboardingData } = data;
      const { error: onboardingError } = await supabase
        .from('user_onboarding')
        .upsert({
          user_id: user.id,
          ...onboardingData,
        });

      if (onboardingError) {
        console.error('🔍 ONBOARDING ERROR: Failed to save onboarding data', {
          error: onboardingError,
          code: onboardingError.code,
          message: onboardingError.message,
          details: onboardingError.details,
          hint: onboardingError.hint
        });
        toast({
          title: "Erro ao salvar",
          description: onboardingError.message || "Erro ao salvar dados do onboarding",
          variant: "destructive",
        });
        return false;
      }

      console.log('🔍 ONBOARDING: Onboarding data saved, updating profile...');

      // Update profile to mark onboarding as completed
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          onboarding_completed: true,
          birth_date: data.birth_date,
          weight_kg: data.weight_kg,
          phone: data.phone,
        })
        .eq('user_id', user.id);

      if (profileError) {
        console.error('🔍 PROFILE ERROR: Failed to update profile', {
          error: profileError,
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint
        });
        toast({
          title: "Erro ao atualizar perfil",
          description: profileError.message || "Erro ao atualizar perfil",
          variant: "destructive",
        });
        return false;
      }

      console.log('🔍 ONBOARDING: Profile updated successfully');

      // Set local state immediately to prevent race condition
      setLocalOnboardingCompleted(true);
      
      toast({
        title: "Sucesso!",
        description: "Perfil configurado com sucesso",
      });

      // Add a small delay to ensure database propagation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('🔍 ONBOARDING: Save process completed successfully');
      await fetchOnboardingData();
      return true;
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar dados do onboarding",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const checkOnboardingStatus = async () => {
    if (!user) return false;

    // If we have local state indicating completion, use it immediately
    if (localOnboardingCompleted === true) {
      console.log('🔍 ONBOARDING: Using local state - completed');
      return true;
    }

    try {
      console.log('🔍 ONBOARDING: Checking database status for user', user.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error checking onboarding status:', error);
        // Em caso de erro, assume que o onboarding foi completado para evitar redirect loops
        return true;
      }

      const isCompleted = data?.onboarding_completed || false;
      console.log('🔍 ONBOARDING: Database status', { isCompleted });
      
      // Update local state to match database
      setLocalOnboardingCompleted(isCompleted);
      
      return isCompleted;
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // Em caso de erro, assume que o onboarding foi completado para evitar redirect loops
      return true;
    }
  };

  useEffect(() => {
    if (user) {
      fetchOnboardingData();
    } else {
      // Reset local state when user logs out
      setLocalOnboardingCompleted(null);
    }
  }, [user]);

  return {
    onboardingData,
    loading,
    saveOnboardingData,
    checkOnboardingStatus,
    refetch: fetchOnboardingData,
    isOnboardingCompleted: localOnboardingCompleted,
  };
};