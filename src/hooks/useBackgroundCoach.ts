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
  notificationFallback?: any;
  backgroundAudio?: {
    getAudioContext: () => AudioContext | null;
  };
}

interface BackgroundCoachState {
  isActive: boolean;
  isEnabled: boolean;
  lastFeedback: CoachingFeedback | null;
  feedbackCount: number;
  error: string | null;
}

export const useBackgroundCoach = (options: BackgroundCoachOptions = {}) => {
  // 🔍 DIAGNÓSTICO: Log das opções recebidas na inicialização
  console.log('[COACH INIT] Options recebidas:', JSON.stringify({
    enabled: options.enabled,
    enableTTS: options.enableTTS,
    hasGoal: !!options.goal,
    goalType: options.goal?.type,
    feedbackInterval: options.feedbackInterval,
    hasNotificationFallback: !!options.notificationFallback,
    hasBackgroundAudio: !!options.backgroundAudio
  }, null, 2));

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

  const playAudioFeedback = useCallback(async (audioUrl: string, message: string) => {
    const isIOSNative = Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform();
    
    console.log('🎵 [AUDIO DEBUG] Tentando reproduzir áudio:', {
      isIOSNative,
      hasAudioUrl: !!audioUrl,
      isDataUrl: audioUrl.startsWith('data:'),
      audioUrlType: audioUrl.startsWith('data:') ? 'base64' : 'url',
      audioUrl: audioUrl.substring(0, 50) + '...',
      timestamp: new Date().toISOString()
    });
    
    try {
      // SEMPRE use native audio player no iOS (funciona em foreground E background)
      if (isIOSNative) {
        console.log('🎵 [AUDIO DEBUG] iOS detectado - usando native audio player (foreground ou background)');
        console.log('🎵 [AUDIO DEBUG] URL do áudio:', audioUrl);
        
        const { BioPeakAudioSession } = await import('@/plugins/BioPeakAudioSession');
        const result = await BioPeakAudioSession.playAudioFile({ url: audioUrl });
        
        console.log('✅ [AUDIO DEBUG] TTS reproduzido via AVAudioPlayer nativo:', result);
        return;
      }
      
      // Try to use shared AudioContext from background audio
      const audioContext = options.backgroundAudio?.getAudioContext();
      
      console.log('🎵 [AUDIO DEBUG] AudioContext status:', {
        hasAudioContext: !!audioContext,
        state: audioContext?.state,
        sampleRate: audioContext?.sampleRate
      });
      
      if (audioContext && audioContext.state !== 'closed') {
        console.log('🎵 [AUDIO DEBUG] Usando AudioContext compartilhado...');
        
        // Fetch and decode audio using AudioContext
        const response = await fetch(audioUrl);
        console.log('🎵 [AUDIO DEBUG] Áudio baixado:', {
          status: response.status,
          contentType: response.headers.get('content-type')
        });
        
        const arrayBuffer = await response.arrayBuffer();
        console.log('🎵 [AUDIO DEBUG] ArrayBuffer size:', arrayBuffer.byteLength);
        
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log('🎵 [AUDIO DEBUG] Áudio decodificado:', {
          duration: audioBuffer.duration,
          channels: audioBuffer.numberOfChannels,
          sampleRate: audioBuffer.sampleRate
        });
        
        // Create source and gain node for volume control
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        
        source.buffer = audioBuffer;
        gainNode.gain.value = 0.8;
        
        // Connect and play
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.start(0);
        
        console.log('✅ [AUDIO DEBUG] TTS reproduzido via AudioContext compartilhado');
        return;
      } else {
        console.log('🎵 [AUDIO DEBUG] AudioContext indisponível, usando Audio element fallback');
        
        // Fallback to regular Audio element
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }

        audioRef.current = new Audio(audioUrl);
        audioRef.current.volume = 0.8;
        await audioRef.current.play();
        console.log('✅ [AUDIO DEBUG] TTS reproduzido via Audio element');
        return;
      }
    } catch (error) {
      console.error('❌ [AUDIO DEBUG] Erro ao reproduzir áudio:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fallback: enviar notificação em caso de erro
      if (error && options.notificationFallback) {
        console.log('📱 [AUDIO DEBUG] Tentando enviar notificação como fallback...');
        await options.notificationFallback.scheduleNotification({
          title: '🏃 BioPeak Coach',
          body: message,
          sound: true,
        });
        console.log('✅ [AUDIO DEBUG] Notificação enviada como fallback');
      }
    }
  }, [options.notificationFallback, options.backgroundAudio]);

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
        // ✅ Flag será setada APÓS reproduzir o áudio com sucesso
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
            body: { text: message, voice: 'alloy', speed: 1.0 }
          });

          if (error) throw error;
          
          // ✅ Convert audioContent (base64) to Data URL
          if (data?.audioContent) {
            audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
            console.log('✅ TTS gerado com sucesso, tamanho:', data.audioContent.length, 'chars');
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
            await playAudioFeedback(feedback.audioUrl, feedback.message);
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

    // Subsequent feedbacks: every 1000m (1km)
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
            await playAudioFeedback(feedback.audioUrl, feedback.message);
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

  const startCoaching = useCallback(async (goal: TrainingGoal) => {
    // 🔍 DIAGNÓSTICO: Estado no momento do startCoaching
    console.log('[START COACHING] Goal:', JSON.stringify(goal, null, 2));
    console.log('[START COACHING] options.enableTTS:', options.enableTTS);
    console.log('[START COACHING] options.enabled:', options.enabled);
    console.log('[START COACHING] state.isActive:', state.isActive);
    console.log('[START COACHING] state.isEnabled:', state.isEnabled);

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

    console.log('🏁 Coach de background iniciado - gerando feedback inicial...');

    // 🔊 Tocar áudio inicial imediatamente
    try {
      const initialMessage = 'Bom treino, estou com você!';
      
      console.log('🔍 DIAGNÓSTICO: Verificando options.enableTTS antes do bloco TTS...');
      if (options.enableTTS) {
        console.log('🎙️ Gerando TTS inicial...');
        const { data, error } = await supabase.functions.invoke('text-to-speech', {
          body: { text: initialMessage, voice: 'alloy', speed: 1.0 },
        });

        if (!error && data?.audioContent) {
          // ✅ Convert audioContent (base64) to Data URL
          const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
          console.log('✅ TTS inicial gerado, reproduzindo...', 'tamanho:', data.audioContent.length);
          await playAudioFeedback(audioUrl, initialMessage);
          hasGivenInitialFeedbackRef.current = true;
          
          setState(prev => ({
            ...prev,
            lastFeedback: {
              message: initialMessage,
              type: 'motivation',
              timestamp: Date.now(),
              audioUrl,
            },
            feedbackCount: 1,
          }));
          
          console.log('🎧 Feedback inicial reproduzido imediatamente');
        } else {
          console.error('❌ Erro ao gerar TTS inicial:', error);
        }
      } else {
        console.log('❌ [DIAGNÓSTICO] Bloco TTS NÃO executado! options.enableTTS =', options.enableTTS);
        console.log('ℹ️ TTS desabilitado, marcando feedback inicial como dado');
        hasGivenInitialFeedbackRef.current = true;
      }
    } catch (err) {
      console.error('❌ Erro ao gerar ou reproduzir TTS inicial:', err);
      // Marcar como dado mesmo em caso de erro para não tentar novamente
      hasGivenInitialFeedbackRef.current = true;
    }
  }, [state.isActive, options.enableTTS, playAudioFeedback]);

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