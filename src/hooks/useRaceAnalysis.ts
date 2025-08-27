import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RaceAnalysisResult {
  estimated_time_minutes: number;
  fitness_level: string;
  readiness_score: number;
  gap_analysis: {
    target_time_minutes: number;
    gap_minutes: number;
    gap_percentage: number;
  };
  suggestions: Array<{
    area: string;
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  focus_areas: string[];
  realistic_target: string;
}

export function useRaceAnalysis() {
  const [analyzing, setAnalyzing] = useState(false);
  const { toast } = useToast();

  const analyzeRaceReadiness = async (raceId: string): Promise<RaceAnalysisResult | null> => {
    setAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-race-readiness', {
        body: { raceId }
      });

      if (error) {
        console.error('Race analysis error:', error);
        
        // Handle specific error cases
        if (error.message?.includes('Insufficient running data')) {
          toast({
            title: "Dados insuficientes",
            description: "Você precisa ter pelo menos algumas corridas registradas para análise.",
            variant: "destructive",
          });
          return null;
        }

        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Análise concluída",
        description: "Sua análise de prontidão para a prova foi atualizada!",
      });

      return data as RaceAnalysisResult;

    } catch (error) {
      console.error('Error analyzing race readiness:', error);
      toast({
        title: "Erro na análise",
        description: "Não foi possível analisar sua prontidão. Tente novamente.",
        variant: "destructive",
      });
      return null;
    } finally {
      setAnalyzing(false);
    }
  };

  const formatTime = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    const seconds = Math.floor((totalMinutes % 1) * 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getReadinessLevel = (score: number) => {
    if (score >= 80) return { level: 'Excelente', color: 'text-green-600' };
    if (score >= 60) return { level: 'Boa', color: 'text-blue-600' };
    if (score >= 40) return { level: 'Regular', color: 'text-yellow-600' };
    return { level: 'Baixa', color: 'text-red-600' };
  };

  const getFitnessLevelDisplay = (level: string) => {
    const levels = {
      'beginner': 'Iniciante',
      'intermediate': 'Intermediário', 
      'advanced': 'Avançado',
      'elite': 'Elite'
    };
    return levels[level as keyof typeof levels] || level;
  };

  return {
    analyzing,
    analyzeRaceReadiness,
    formatTime,
    getReadinessLevel,
    getFitnessLevelDisplay,
  };
}