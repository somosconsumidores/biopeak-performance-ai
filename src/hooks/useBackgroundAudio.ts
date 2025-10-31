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

    try {
      // Start AVAudioSession on iOS (now includes silent audio player)
      if (Capacitor.getPlatform() === 'ios') {
        await BioPeakAudioSession.startAudioSession();
        console.log('✅ AVAudioSession started with silent audio');
      }

      // Create shared audio context for TTS
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;

      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      setState(prev => ({ ...prev, isActive: true, error: null }));
      console.log('Background audio started');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start background audio';
      setState(prev => ({ ...prev, error: errorMessage }));
      console.error('Background audio error:', error);
    }
  };

  const stopBackgroundAudio = async () => {
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop AVAudioSession on iOS (also stops silent audio)
    if (Capacitor.getPlatform() === 'ios') {
      await BioPeakAudioSession.stopAudioSession();
      console.log('✅ AVAudioSession stopped');
    }

    setState(prev => ({ ...prev, isActive: false }));
    console.log('Background audio stopped');
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

    return () => {
      stopBackgroundAudio();
    };
  }, [enabled, state.isSupported]);

  return {
    ...state,
    startBackgroundAudio,
    stopBackgroundAudio,
    getAudioContext: () => audioContextRef.current,
  };
};

