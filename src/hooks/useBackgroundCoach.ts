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
  [key: string]: any;
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
  const lastAnalysisRef = useRef<number>(0);
  const feedbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
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

  const generateCoachingFeedback = useCallback(async (sessionData: SessionData): Promise<CoachingFeedback | null> => {
    if (!goalRef.current) return null;

    try {
      const goal = goalRef.current;
      const currentPace = sessionData.pace;
      const currentDistance = sessionData.distance / 1000; // Convert to km
      const duration = sessionData.duration / 60; // Convert to minutes

      let message = '';
      let type: CoachingFeedback['type'] = 'motivation';

      // Analyze performance based on goal
      if (goal.type === 'target_pace' && goal.targetPace) {
        const targetPace = goal.targetPace;
        const paceDifference = currentPace - targetPace;

        if (Math.abs(paceDifference) <= 0.1) {
          message = `Perfeito! Você está mantendo o pace ideal de ${targetPace.toFixed(1)} min/km.`;
          type = 'achievement';
        } else if (paceDifference > 0.3) {
          message = `Você está ${paceDifference.toFixed(1)} min/km mais lento que o objetivo. Tente acelerar um pouco!`;
          type = 'instruction';
        } else if (paceDifference < -0.3) {
          message = `Cuidado! Você está ${Math.abs(paceDifference).toFixed(1)} min/km mais rápido que o planejado. Considere diminuir o ritmo.`;
          type = 'warning';
        } else {
          message = `Continue assim! Pace atual: ${currentPace.toFixed(1)} min/km.`;
          type = 'motivation';
        }
      } else if (goal.type === 'target_distance' && goal.targetDistance) {
        const targetDistance = goal.targetDistance / 1000; // Convert to km
        const progress = (currentDistance / targetDistance) * 100;

        if (progress >= 100) {
          message = `Parabéns! Você completou os ${targetDistance}km do seu objetivo!`;
          type = 'achievement';
        } else if (progress >= 75) {
          message = `Quase lá! Você já completou ${progress.toFixed(0)}% do seu objetivo. Continue firme!`;
          type = 'motivation';
        } else if (progress >= 50) {
          message = `Metade do caminho concluída! ${currentDistance.toFixed(1)}km de ${targetDistance}km.`;
          type = 'motivation';
        } else if (progress >= 25) {
          message = `Bom progresso! Você já correu ${currentDistance.toFixed(1)}km.`;
          type = 'motivation';
        } else {
          message = `Vamos começar! Objetivo: ${targetDistance}km. Você consegue!`;
          type = 'motivation';
        }
      } else if (goal.type === 'target_duration' && goal.targetDuration) {
        const targetDuration = goal.targetDuration / 60; // Convert to minutes
        const progress = (duration / targetDuration) * 100;

        if (progress >= 100) {
          message = `Excelente! Você completou os ${targetDuration} minutos de treino!`;
          type = 'achievement';
        } else if (progress >= 75) {
          message = `Faltam apenas ${Math.round(targetDuration - duration)} minutos! Continue!`;
          type = 'motivation';
        } else {
          message = `${Math.round(duration)} minutos de treino. Continue no seu ritmo!`;
          type = 'motivation';
        }
      } else {
        // Generic motivational messages
        const motivationalMessages = [
          'Você está indo muito bem! Continue assim!',
          'Mantenha o foco e a respiração controlada.',
          'Cada passo te deixa mais forte!',
          'Excelente performance até agora!',
          'Continue firme no seu objetivo!'
        ];
        message = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
        type = 'motivation';
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

  const analyzePerformance = useCallback(async (sessionData: SessionData) => {
    if (!state.isActive || !state.isEnabled) return;

    const now = Date.now();
    const timeSinceLastAnalysis = now - lastAnalysisRef.current;
    const minInterval = options.feedbackInterval || 30000; // 30 seconds default

    // Don't analyze too frequently
    if (timeSinceLastAnalysis < minInterval) return;

    try {
      const feedback = await generateCoachingFeedback(sessionData);
      
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

        // Log feedback for debugging
        console.log('BioPeak Coach:', feedback.message);

        lastAnalysisRef.current = now;
        console.log('Feedback do coach gerado:', feedback.message);
      }
    } catch (error) {
      console.error('Erro na análise de performance:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Erro na análise' 
      }));
    }
  }, [state.isActive, state.isEnabled, options.feedbackInterval, generateCoachingFeedback, playAudioFeedback]);

  const startCoaching = useCallback((goal: TrainingGoal) => {
    if (state.isActive) {
      console.warn('Coach já está ativo');
      return;
    }

    goalRef.current = goal;
    lastAnalysisRef.current = 0;

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
    
    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }

    console.log('Coach pausado');
  }, []);

  const resumeCoaching = useCallback(() => {
    setState(prev => ({ ...prev, isActive: true }));
    lastAnalysisRef.current = 0; // Reset to allow immediate feedback
    console.log('Coach retomado');
  }, []);

  const stopCoaching = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: false,
      feedbackCount: 0,
    }));

    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }

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
      if (feedbackIntervalRef.current) {
        clearInterval(feedbackIntervalRef.current);
      }
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