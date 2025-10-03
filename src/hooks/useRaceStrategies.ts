import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SavedRaceStrategy {
  id: string;
  strategy_name: string;
  distance_km: number;
  objective_type: 'time' | 'pace';
  target_time_seconds: number | null;
  target_pace_seconds: number | null;
  strategy_type: 'constant' | 'negative' | 'positive';
  intensity_percentage: number;
  km_distribution: any[];
  total_time_seconds: number;
  avg_pace_seconds: number;
  created_at: string;
  updated_at: string;
}

export function useRaceStrategies() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const saveStrategy = async (
    strategyName: string,
    distanceKm: number,
    objectiveType: 'time' | 'pace',
    targetTimeSeconds: number | null,
    targetPaceSeconds: number | null,
    strategyType: 'constant' | 'negative' | 'positive',
    intensityPercentage: number,
    kmDistribution: any[],
    totalTimeSeconds: number,
    avgPaceSeconds: number
  ) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para salvar estratégias.",
          variant: "destructive",
        });
        return null;
      }

      const { data, error } = await supabase
        .from('race_strategies')
        .insert({
          user_id: user.id,
          strategy_name: strategyName,
          distance_km: distanceKm,
          objective_type: objectiveType,
          target_time_seconds: targetTimeSeconds,
          target_pace_seconds: targetPaceSeconds,
          strategy_type: strategyType,
          intensity_percentage: intensityPercentage,
          km_distribution: kmDistribution,
          total_time_seconds: totalTimeSeconds,
          avg_pace_seconds: avgPaceSeconds,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Estratégia salva com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Error saving strategy:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a estratégia. Tente novamente.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const loadStrategies = async (): Promise<SavedRaceStrategy[]> => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('race_strategies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error loading strategies:', error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar as estratégias salvas.",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const deleteStrategy = async (id: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('race_strategies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Estratégia excluída com sucesso.",
      });

      return true;
    } catch (error) {
      console.error('Error deleting strategy:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a estratégia. Tente novamente.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateStrategy = async (
    id: string,
    strategyName: string,
    distanceKm: number,
    objectiveType: 'time' | 'pace',
    targetTimeSeconds: number | null,
    targetPaceSeconds: number | null,
    strategyType: 'constant' | 'negative' | 'positive',
    intensityPercentage: number,
    kmDistribution: any[],
    totalTimeSeconds: number,
    avgPaceSeconds: number
  ) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('race_strategies')
        .update({
          strategy_name: strategyName,
          distance_km: distanceKm,
          objective_type: objectiveType,
          target_time_seconds: targetTimeSeconds,
          target_pace_seconds: targetPaceSeconds,
          strategy_type: strategyType,
          intensity_percentage: intensityPercentage,
          km_distribution: kmDistribution,
          total_time_seconds: totalTimeSeconds,
          avg_pace_seconds: avgPaceSeconds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Estratégia atualizada com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Error updating strategy:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar a estratégia. Tente novamente.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    saveStrategy,
    loadStrategies,
    deleteStrategy,
    updateStrategy,
    isLoading,
  };
}
