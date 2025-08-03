import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';
import { supabase } from '@/integrations/supabase/client';
import { TrainingGoal } from './useRealtimeSession';

// Extended SessionData for background functionality
interface SessionData {
  distance: number;
  duration: number;
  pace: number;
  calories: number;
  goal?: TrainingGoal;
  sessionId?: string;
  [key: string]: any;
}

interface LastKmStats {
  averagePace: number;
  averageHeartRate?: number;
  distance: number;
}

interface CoachingFeedback {
  message: string;
  type: 'motivation' | 'instruction' | 'warning' | 'achievement';
  timestamp: number;
  audioUrl?: string;
}

interface BackgroundCoachOptions {
  enabled?: boolean;
  goal?: TrainingGoal;
  feedbackInterval?: number;
  enableTTS?: boolean;
}

interface BackgroundCoachState {
  isActive: boolean;
  isEnabled: boolean;
  lastFeedback: CoachingFeedback | null;
  feedbackCount: number;
  error: string | null;
}

export const useBackgroundCoach = (options: BackgroundCoachOptions = {}) => {
  const [state, setState] = useState<BackgroundCoachState>({
    isActive: false,
    isEnabled: options.enabled ?? true,
    lastFeedback: null,
    feedbackCount: 0,
    error: null,
  });

  const goalRef = useRef<TrainingGoal | undefined>(options.goal);
  const lastFeedbackDistanceRef = useRef<number>(0);
  const hasGivenInitialFeedbackRef = useRef<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Update goal when options change
  useEffect(() => {
    goalRef.current = options.goal;
  }, [options.goal]);

  const playAudioFeedback = useCallback(async (audioUrl: string) => {
    if (!options.enableTTS || !Capacitor.isNativePlatform()) return;

    try {
      // Create and play audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      audioRef.current = new Audio(audioUrl);
      audioRef.current.volume = 0.8;
      
      await audioRef.current.play();
      console.log('Audio feedback reproduzido com sucesso');
    } catch (error) {
      console.error('Erro ao reproduzir áudio:', error);
    }
  }, [options.enableTTS]);

  const calculateLastKmStats = useCallback(async (sessionId: string, currentDistance: number): Promise<LastKmStats | null> => {
    if (!sessionId || currentDistance < 1000) return null;

    try {
      const fromDistance = Math.max(0, currentDistance - 1000);
      
      const { data: snapshots, error } = await supabase
        .from('performance_snapshots')
        .select('*')
        .eq('session_id', sessionId)
        .gte('snapshot_at_distance_meters', fromDistance)
        .lte('snapshot_at_distance_meters', currentDistance)
        .order('snapshot_at_distance_meters', { ascending: true });

      if (error || !snapshots || snapshots.length === 0) {
        console.log('Não foi possível obter dados do último KM');
        return null;
      }

      // Calculate average pace for the last KM
      const totalPace = snapshots.reduce((sum, snapshot) => sum + (snapshot.current_pace_min_km || 0), 0);
      const averagePace = totalPace / snapshots.length;
      
      // Calculate average heart rate if available
      const hrSnapshots = snapshots.filter(s => s.current_heart_rate);
      const averageHeartRate = hrSnapshots.length > 0 
        ? hrSnapshots.reduce((sum, s) => sum + s.current_heart_rate, 0) / hrSnapshots.length 
        : undefined;

      return {
        averagePace,
        averageHeartRate,
        distance: 1000
      };
    } catch (error) {
      console.error('Erro ao calcular stats do último KM:', error);
      return null;
    }
  }, []);

  const generateCoachingFeedback = useCallback(async (sessionData: SessionData, lastKmStats?: LastKmStats | null): Promise<CoachingFeedback | null> => {
    if (!goalRef.current) return null;

    try {
      const goal = goalRef.current;
      const currentDistance = sessionData.distance / 1000; // Convert to km
      const duration = sessionData.duration / 60; // Convert to minutes

      let message = '';
      let type: CoachingFeedback['type'] = 'motivation';

      // Initial feedback
      if (!hasGivenInitialFeedbackRef.current) {
        message = 'Bom treino, estou com você!';
        type = 'motivation';
        hasGivenInitialFeedbackRef.current = true;
      } else {
        // Subsequent feedbacks with last KM stats + objective analysis
        let statsMessage = '';
        if (lastKmStats) {
          const paceMin = Math.floor(lastKmStats.averagePace);
          const paceSec = Math.round((lastKmStats.averagePace - paceMin) * 60);
          statsMessage = `Último quilômetro: pace de ${paceMin}:${paceSec.toString().padStart(2, '0')} min/km. `;
        }

        // Objective-based analysis
        let objectiveMessage = '';
        if (goal.type === 'target_pace' && goal.targetPace && lastKmStats) {
          const targetPace = goal.targetPace;
          const paceDifference = lastKmStats.averagePace - targetPace;
          
          if (Math.abs(paceDifference) <= 0.1) {
            objectiveMessage = `Perfeito! Você está mantendo o pace ideal de ${Math.floor(targetPace)}:${Math.round((targetPace - Math.floor(targetPace)) * 60).toString().padStart(2, '0')}.`;
            type = 'achievement';
          } else if (paceDifference > 0.2) {
            objectiveMessage = `Você está ${Math.abs(paceDifference).toFixed(1)} min/km mais lento que o objetivo. Tente acelerar um pouco!`;
            type = 'instruction';
          } else if (paceDifference < -0.2) {
            objectiveMessage = `Cuidado! Você está ${Math.abs(paceDifference).toFixed(1)} min/km mais rápido que o planejado. Considere diminuir o ritmo.`;
            type = 'warning';
          } else {
            objectiveMessage = `Continue assim! Muito próximo do pace objetivo.`;
            type = 'motivation';
          }
        } else if (goal.type === 'target_distance' && goal.targetDistance) {
          const targetDistance = goal.targetDistance / 1000;
          const progress = (currentDistance / targetDistance) * 100;
          const remaining = targetDistance - currentDistance;
          
          if (progress >= 100) {
            objectiveMessage = `Parabéns! Você completou os ${targetDistance}km do seu objetivo!`;
            type = 'achievement';
          } else if (remaining <= 1) {
            objectiveMessage = `Quase lá! Faltam apenas ${(remaining * 1000).toFixed(0)}m para completar!`;
            type = 'motivation';
          } else if (progress >= 75) {
            objectiveMessage = `Excelente! Faltam ${remaining.toFixed(1)}km do seu objetivo de ${targetDistance}km.`;
            type = 'motivation';
          } else if (progress >= 50) {
            objectiveMessage = `Metade do caminho! ${currentDistance.toFixed(1)}km de ${targetDistance}km completados.`;
            type = 'motivation';
          } else {
            objectiveMessage = `Continue no ritmo! ${remaining.toFixed(1)}km restantes do seu objetivo.`;
            type = 'motivation';
          }
        } else if (goal.type === 'target_duration' && goal.targetDuration) {
          const targetDuration = goal.targetDuration / 60;
          const remaining = targetDuration - duration;
          
          if (remaining <= 0) {
            objectiveMessage = `Excelente! Você completou os ${targetDuration} minutos de treino!`;
            type = 'achievement';
          } else if (remaining <= 5) {
            objectiveMessage = `Faltam apenas ${Math.round(remaining)} minutos! Finalize com força!`;
            type = 'motivation';
          } else {
            objectiveMessage = `${Math.round(remaining)} minutos restantes do seu treino. Continue firme!`;
            type = 'motivation';
          }
        } else {
          // Free run
          objectiveMessage = `Excelente consistência! Continue no seu ritmo.`;
          type = 'motivation';
        }

        message = statsMessage + objectiveMessage;
      }

      // Generate TTS audio if enabled
      let audioUrl: string | undefined;
      if (options.enableTTS && message) {
        try {
          const { data, error } = await supabase.functions.invoke('text-to-speech', {
            body: { text: message, voice: 'pt-BR', speed: 1.0 }
          });

          if (error) throw error;
          if (data?.audioUrl) {
            audioUrl = data.audioUrl;
          }
        } catch (error) {
          console.error('Erro ao gerar TTS:', error);
          // Continue without audio
        }
      }

      return {
        message,
        type,
        timestamp: Date.now(),
        audioUrl,
      };
    } catch (error) {
      console.error('Erro ao gerar feedback do coach:', error);
      return null;
    }
  }, [options.enableTTS]);

  const isProcessingRef = useRef<boolean>(false);

  const analyzePerformance = useCallback(async (sessionData: SessionData) => {
    if (!state.isActive || !state.isEnabled || isProcessingRef.current) return;

    const currentDistance = sessionData.distance;
    const distanceSinceLastFeedback = currentDistance - lastFeedbackDistanceRef.current;

    console.log('🔍 Coach Analysis:', {
      currentDistance,
      lastFeedbackDistance: lastFeedbackDistanceRef.current,
      hasGivenInitial: hasGivenInitialFeedbackRef.current,
      distanceSinceLastFeedback
    });

    // Initial feedback: only once at the beginning
    if (!hasGivenInitialFeedbackRef.current) {
      console.log('✅ Triggering INITIAL feedback');
      isProcessingRef.current = true;
      
      try {
        const feedback = await generateCoachingFeedback(sessionData, null);
        
        if (feedback) {
          setState(prev => ({
            ...prev,
            lastFeedback: feedback,
            feedbackCount: prev.feedbackCount + 1,
            error: null,
          }));

          // Play audio feedback if available
          if (feedback.audioUrl) {
            await playAudioFeedback(feedback.audioUrl);
          }

          // Update tracking
          hasGivenInitialFeedbackRef.current = true;
          lastFeedbackDistanceRef.current = currentDistance;

          console.log('🎯 Initial Coach Feedback:', feedback.message);
        }
      } catch (error) {
        console.error('Erro no feedback inicial:', error);
        setState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Erro na análise' 
        }));
      } finally {
        isProcessingRef.current = false;
      }
      return;
    }

    // Subsequent feedbacks: every 1000m (1km) traveled since last feedback
    if (distanceSinceLastFeedback >= 1000) {
      console.log('✅ Triggering 1KM feedback - Distance since last:', distanceSinceLastFeedback);
      isProcessingRef.current = true;
      
      try {
        let lastKmStats: LastKmStats | null = null;
        
        // Get last KM stats if we have sessionId
        if (sessionData.sessionId && currentDistance >= 1000) {
          lastKmStats = await calculateLastKmStats(sessionData.sessionId, currentDistance);
        }

        const feedback = await generateCoachingFeedback(sessionData, lastKmStats);
        
        if (feedback) {
          setState(prev => ({
            ...prev,
            lastFeedback: feedback,
            feedbackCount: prev.feedbackCount + 1,
            error: null,
          }));

          // Play audio feedback if available
          if (feedback.audioUrl) {
            await playAudioFeedback(feedback.audioUrl);
          }

          // Update last feedback distance
          lastFeedbackDistanceRef.current = currentDistance;

          console.log('🎯 1KM Coach Feedback:', feedback.message);
        }
      } catch (error) {
        console.error('Erro no feedback de 1km:', error);
        setState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Erro na análise' 
        }));
      } finally {
        isProcessingRef.current = false;
      }
    } else {
      console.log('⏳ No feedback needed - Distance since last:', distanceSinceLastFeedback, 'm (need 1000m)');
    }
  }, [state.isActive, state.isEnabled, generateCoachingFeedback, playAudioFeedback, calculateLastKmStats]);

  const startCoaching = useCallback((goal: TrainingGoal) => {
    if (state.isActive) {
      console.warn('Coach já está ativo');
      return;
    }

    goalRef.current = goal;
    lastFeedbackDistanceRef.current = 0;
    hasGivenInitialFeedbackRef.current = false;
    isProcessingRef.current = false;

    setState(prev => ({
      ...prev,
      isActive: true,
      feedbackCount: 0,
      error: null,
    }));

    console.log('Coach de background iniciado');
  }, [state.isActive]);

  const pauseCoaching = useCallback(() => {
    setState(prev => ({ ...prev, isActive: false }));
    console.log('Coach pausado');
  }, []);

  const resumeCoaching = useCallback(() => {
    setState(prev => ({ ...prev, isActive: true }));
    console.log('Coach retomado');
  }, []);

  const stopCoaching = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: false,
      feedbackCount: 0,
    }));

    // Reset all feedback tracking
    lastFeedbackDistanceRef.current = 0;
    hasGivenInitialFeedbackRef.current = false;
    isProcessingRef.current = false;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    console.log('Coach parado');
  }, []);

  const enableCoaching = useCallback(() => {
    setState(prev => ({ ...prev, isEnabled: true }));
  }, []);

  const disableCoaching = useCallback(() => {
    setState(prev => ({ ...prev, isEnabled: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return {
    ...state,
    analyzePerformance,
    startCoaching,
    pauseCoaching,
    resumeCoaching,
    stopCoaching,
    enableCoaching,
    disableCoaching,
  };
};