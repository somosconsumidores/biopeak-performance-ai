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
  const silenceSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    // Check if running on native iOS
    const isIOS = Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform();
    setState(prev => ({ ...prev, isSupported: isIOS }));
  }, []);

  const startBackgroundAudio = async () => {
    if (!state.isSupported || !enabled) return;

    try {
      // Initialize AVAudioSession on iOS first
      if (Capacitor.getPlatform() === 'ios') {
        await BioPeakAudioSession.startAudioSession();
        console.log('✅ AVAudioSession started');
      }

      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;

      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Create a silent audio buffer to keep audio session active
      const bufferSize = audioContext.sampleRate * 0.5; // 0.5 second
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const channelData = buffer.getChannelData(0);
      
      // Fill with low volume sine wave (increased from 0.001 to 0.01 for iOS)
      for (let i = 0; i < bufferSize; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 20 * i / audioContext.sampleRate) * 0.01;
      }

      // Create and start looping silent audio
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(audioContext.destination);
      source.start(0);

      silenceSourceRef.current = source;

      setState(prev => ({ ...prev, isActive: true, error: null }));
      console.log('Background audio started');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start background audio';
      setState(prev => ({ ...prev, error: errorMessage }));
      console.error('Background audio error:', error);
    }
  };

  const stopBackgroundAudio = async () => {
    if (silenceSourceRef.current) {
      silenceSourceRef.current.stop();
      silenceSourceRef.current.disconnect();
      silenceSourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop AVAudioSession on iOS
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

