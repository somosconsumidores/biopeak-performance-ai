import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BioPeakAudioSession } from '@/plugins/BioPeakAudioSession';

interface BackgroundAudioOptions {
  enabled: boolean;
}

interface BackgroundAudioState {
  isActive: boolean;
  isSupported: boolean;
  error: string | null;
}

export const useBackgroundAudio = ({ enabled }: BackgroundAudioOptions) => {
  const [state, setState] = useState<BackgroundAudioState>({
    isActive: false,
    isSupported: false,
    error: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Check if running on native iOS
    const isIOS = Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform();
    setState(prev => ({ ...prev, isSupported: isIOS }));
  }, []);

  const startBackgroundAudio = async () => {
    if (!state.isSupported || !enabled) return;

    console.log('🎵 [BG AUDIO] Iniciando background audio...');

    try {
      // Start AVAudioSession on iOS (now includes silent audio player)
      if (Capacitor.getPlatform() === 'ios') {
        console.log('🎵 [BG AUDIO] Iniciando AVAudioSession no iOS...');
        const result = await BioPeakAudioSession.startAudioSession();
        console.log('✅ [BG AUDIO] AVAudioSession iniciada:', result);
      }

      // Create shared audio context for TTS
      if (!audioContextRef.current) {
        console.log('🎵 [BG AUDIO] Criando novo AudioContext...');
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;
      console.log('🎵 [BG AUDIO] AudioContext status:', {
        state: audioContext.state,
        sampleRate: audioContext.sampleRate,
        currentTime: audioContext.currentTime
      });

      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        console.log('🎵 [BG AUDIO] AudioContext suspenso, resumindo...');
        await audioContext.resume();
        console.log('✅ [BG AUDIO] AudioContext resumido:', audioContext.state);
      }

      setState(prev => ({ ...prev, isActive: true, error: null }));
      console.log('✅ [BG AUDIO] Background audio ativo');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start background audio';
      setState(prev => ({ ...prev, error: errorMessage }));
      console.error('❌ [BG AUDIO] Erro:', error);
    }
  };

  const stopBackgroundAudio = async () => {
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // ❌ NÃO pare stopAudioSession aqui!
    // A sessão deve ser parada apenas quando o treino finalizar (useRealtimeSession.completeSession)

    setState(prev => ({ ...prev, isActive: false }));
    console.log('Background audio stopped (session still active)');
  };

  // Handle visibility changes
  useEffect(() => {
    if (!state.isSupported) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && enabled && !state.isActive) {
        startBackgroundAudio();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, state.isActive, state.isSupported]);

  // Auto-start/stop based on enabled state
  useEffect(() => {
    if (!state.isSupported) return;

    if (enabled) {
      startBackgroundAudio();
    } else {
      stopBackgroundAudio();
    }

    // ❌ REMOVIDO: cleanup que parava a sessão automaticamente
    // A sessão deve permanecer ativa durante todo o treino
    // e só deve ser parada em completeSession()
  }, [enabled, state.isSupported]);

  return {
    ...state,
    startBackgroundAudio,
    stopBackgroundAudio,
    getAudioContext: () => audioContextRef.current,
  };
};

