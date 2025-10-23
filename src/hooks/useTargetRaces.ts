import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { validateRaceTime } from "@/utils/raceTimeValidation";

export interface TargetRace {
  id: string;
  user_id: string;
  race_name: string;
  race_date: string;
  distance_meters: number;
  target_time_minutes?: number;
  race_location?: string;
  race_url?: string;
  notes?: string;
  status: 'planned' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface RaceProgress {
  id: string;
  race_id: string;
  user_id: string;
  snapshot_date: string;
  estimated_time_minutes?: number;
  fitness_level?: string;
  readiness_score?: number;
  gap_analysis?: any;
  improvement_suggestions?: any[];
  training_focus_areas?: string[];
  created_at: string;
}

export function useTargetRaces() {
  const [races, setRaces] = useState<TargetRace[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchRaces = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_target_races')
        .select('*')
        .eq('user_id', user.id)
        .order('race_date', { ascending: true });

      if (error) throw error;
      setRaces(data || []);
    } catch (error) {
      console.error('Error fetching races:', error);
      toast({
        title: "Erro ao carregar provas",
        description: "Não foi possível carregar suas provas alvo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addRace = async (raceData: Omit<TargetRace, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;

    // SERVER-SIDE VALIDATION: Critical layer to prevent impossible times
    if (raceData.target_time_minutes && raceData.distance_meters) {
      console.log('🔍 SERVER-SIDE validation input:', {
        targetMinutes: raceData.target_time_minutes,
        distanceMeters: raceData.distance_meters,
        targetType: typeof raceData.target_time_minutes,
        distanceType: typeof raceData.distance_meters,
        raceData
      });

      const validation = validateRaceTime(
        raceData.target_time_minutes,
        raceData.distance_meters,
        undefined // No historical data at this level
      );

      console.log('🔍 SERVER-SIDE validation result:', validation);

      if (!validation.canProceed) {
        console.error('🚫 Server-side validation blocked race creation:', {
          targetMinutes: raceData.target_time_minutes,
          distanceMeters: raceData.distance_meters,
          validation
        });

        toast({
          title: "Tempo impossível detectado",
          description: validation.message,
          variant: "destructive",
        });
        return null;
      }
    }

    try {
      const { data, error } = await supabase
        .from('user_target_races')
        .insert({
          ...raceData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setRaces(prev => [...prev, data]);
      toast({
        title: "Prova adicionada",
        description: "Sua prova alvo foi adicionada com sucesso!",
      });

      return data;
    } catch (error) {
      console.error('Error adding race:', error);
      toast({
        title: "Erro ao adicionar prova",
        description: "Não foi possível adicionar a prova. Tente novamente.",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateRace = async (raceId: string, updates: Partial<TargetRace>) => {
    // SERVER-SIDE VALIDATION: Critical layer to prevent impossible times
    if (updates.target_time_minutes && updates.distance_meters) {
      const validation = validateRaceTime(
        updates.target_time_minutes,
        updates.distance_meters,
        undefined // No historical data at this level
      );

      if (!validation.canProceed) {
        console.error('🚫 Server-side validation blocked race update:', {
          targetMinutes: updates.target_time_minutes,
          distanceMeters: updates.distance_meters,
          validation
        });

        toast({
          title: "Tempo impossível detectado",
          description: validation.message,
          variant: "destructive",
        });
        return null;
      }
    }

    try {
      const { data, error } = await supabase
        .from('user_target_races')
        .update(updates)
        .eq('id', raceId)
        .eq('user_id', user?.id)
        .select()
        .single();

      if (error) throw error;

      setRaces(prev => prev.map(race => 
        race.id === raceId ? { ...race, ...data } : race
      ));

      toast({
        title: "Prova atualizada",
        description: "As informações da prova foram atualizadas.",
      });

      return data;
    } catch (error) {
      console.error('Error updating race:', error);
      toast({
        title: "Erro ao atualizar prova",
        description: "Não foi possível atualizar a prova. Tente novamente.",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteRace = async (raceId: string) => {
    try {
      const { error } = await supabase
        .from('user_target_races')
        .delete()
        .eq('id', raceId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setRaces(prev => prev.filter(race => race.id !== raceId));
      toast({
        title: "Prova removida",
        description: "A prova foi removida da sua lista.",
      });
    } catch (error) {
      console.error('Error deleting race:', error);
      toast({
        title: "Erro ao remover prova",
        description: "Não foi possível remover a prova. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const getRaceProgress = async (raceId: string): Promise<RaceProgress[]> => {
    try {
      const { data, error } = await supabase
        .from('race_progress_snapshots')
        .select('*')
        .eq('race_id', raceId)
        .eq('user_id', user?.id)
        .order('snapshot_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching race progress:', error);
      return [];
    }
  };

  useEffect(() => {
    fetchRaces();
  }, [user]);

  return {
    races,
    loading,
    addRace,
    updateRace,
    deleteRace,
    getRaceProgress,
    refetch: fetchRaces,
  };
}