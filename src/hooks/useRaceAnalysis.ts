import { useState } from "react";
import { useAthleteAnalysis } from "@/hooks/useAthleteAnalysis";

export interface RaceAnalysisResult {
  estimated_time_minutes: number;
  fitness_level: string;
  gap_analysis: {
    target_time_minutes: number;
    gap_minutes: number;
    gap_percentage: number;
  };
}

export function useRaceAnalysis() {
  const [analyzing, setAnalyzing] = useState(false);
  const { level, raceEstimates, loading, refresh } = useAthleteAnalysis();

  const analyzeRaceReadiness = async (race: { distance_meters: number; target_time_minutes?: number }): Promise<RaceAnalysisResult | null> => {
    setAnalyzing(true);
    
    try {
      // Refresh athlete analysis data
      await refresh();
      
      // Calculate estimated time based on distance
      let estimatedTimeMinutes = 0;
      const distanceKm = race.distance_meters / 1000;
      
      if (distanceKm <= 7.5 && raceEstimates.k5) {
        // Use 5K as base for shorter distances
        const base5kSeconds = raceEstimates.k5.seconds;
        estimatedTimeMinutes = (base5kSeconds * distanceKm / 5) / 60;
      } else if (distanceKm <= 15 && raceEstimates.k10) {
        // Use 10K for medium distances
        const base10kSeconds = raceEstimates.k10.seconds;
        estimatedTimeMinutes = (base10kSeconds * distanceKm / 10) / 60;
      } else if (distanceKm <= 31 && raceEstimates.k21) {
        // Use 21K for longer distances
        const base21kSeconds = raceEstimates.k21.seconds;
        estimatedTimeMinutes = (base21kSeconds * distanceKm / 21.097) / 60;
      } else if (raceEstimates.k42) {
        // Use 42K for very long distances
        const base42kSeconds = raceEstimates.k42.seconds;
        estimatedTimeMinutes = (base42kSeconds * distanceKm / 42.195) / 60;
      } else {
        // Fallback: use 10K estimate if available
        if (raceEstimates.k10) {
          const base10kSeconds = raceEstimates.k10.seconds;
          estimatedTimeMinutes = (base10kSeconds * distanceKm / 10) / 60;
        } else {
          throw new Error('Dados insuficientes para estimativa');
        }
      }

      // Calculate gap analysis if target time exists
      let gapAnalysis = {
        target_time_minutes: 0,
        gap_minutes: 0,
        gap_percentage: 0
      };

      if (race.target_time_minutes) {
        const gapMinutes = estimatedTimeMinutes - race.target_time_minutes;
        const gapPercentage = (gapMinutes / race.target_time_minutes) * 100;
        
        gapAnalysis = {
          target_time_minutes: race.target_time_minutes,
          gap_minutes: gapMinutes,
          gap_percentage: gapPercentage
        };
      }

      return {
        estimated_time_minutes: estimatedTimeMinutes,
        fitness_level: level?.toLowerCase() || 'beginner',
        gap_analysis: gapAnalysis
      };

    } catch (error) {
      console.error('Error analyzing race readiness:', error);
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