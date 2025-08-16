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
    try {
      const { error } = await supabase
        .from('user_onboarding')
        .upsert({
          user_id: user.id,
          ...data,
        });

      if (error) {
        console.error('Error saving onboarding data:', error);
        toast({
          title: "Erro",
          description: "Erro ao salvar dados do onboarding",
          variant: "destructive",
        });
        return false;
      }

      // Update profile to mark onboarding as completed
      await supabase
        .from('profiles')
        .update({ 
          onboarding_completed: true,
          birth_date: data.birth_date,
          weight_kg: data.weight_kg,
        })
        .eq('user_id', user.id);

      toast({
        title: "Sucesso!",
        description: "Perfil configurado com sucesso",
      });

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

    try {
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

      return data?.onboarding_completed || false;
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // Em caso de erro, assume que o onboarding foi completado para evitar redirect loops
      return true;
    }
  };

  useEffect(() => {
    if (user) {
      fetchOnboardingData();
    }
  }, [user]);

  return {
    onboardingData,
    loading,
    saveOnboardingData,
    checkOnboardingStatus,
    refetch: fetchOnboardingData,
  };
};