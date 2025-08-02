import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TTSOptions {
  voice?: string;
  speed?: number;
  priority?: 'low' | 'normal' | 'high';
}

export const useEnhancedTTS = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio context
  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Play audio from base64
  const playAudio = useCallback(async (base64Audio: string) => {
    try {
      setIsSpeaking(true);
      
      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      // Convert base64 to blob
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and play audio element
      const audio = new Audio(audioUrl);
      audio.volume = volume;
      currentAudioRef.current = audio;

      return new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          resolve();
        };
        
        audio.onerror = (error) => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          reject(error);
        };
        
        audio.play().catch(reject);
      });
    } catch (error) {
      setIsSpeaking(false);
      throw error;
    }
  }, [volume]);

  // Enhanced speak function with ElevenLabs fallback to native TTS
  const speak = useCallback(async (text: string, options: TTSOptions = {}) => {
    if (!isEnabled || !text.trim()) return;

    console.log('🔊 Enhanced TTS: Speaking text:', text.substring(0, 50) + '...');

    try {
      // Try ElevenLabs TTS first
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { 
          text, 
          voice: options.voice || 'alloy',
          speed: options.speed || 1.0
        }
      });

      if (error) {
        console.warn('⚠️ ElevenLabs TTS failed, falling back to native:', error);
        throw error;
      }

      if (data?.audioContent) {
        await playAudio(data.audioContent);
        console.log('✅ ElevenLabs TTS completed successfully');
        return;
      }
    } catch (error) {
      console.warn('⚠️ Enhanced TTS failed, falling back to native TTS:', error);
    }

    // Fallback to native browser TTS
    try {
      if ('speechSynthesis' in window) {
        console.log('🔊 Using native browser TTS fallback');
        
        // Stop any ongoing speech
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = options.speed || 0.9;
        utterance.pitch = 1;
        utterance.volume = volume;
        utterance.lang = 'pt-BR';
        
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        
        speechSynthesis.speak(utterance);
      } else {
        console.error('❌ No TTS support available');
      }
    } catch (error) {
      console.error('❌ Native TTS also failed:', error);
      setIsSpeaking(false);
    }
  }, [isEnabled, volume, playAudio]);

  // Stop all speech
  const stop = useCallback(() => {
    setIsSpeaking(false);
    
    // Stop enhanced TTS
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    
    // Stop native TTS
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }, []);

  // Toggle TTS enabled state
  const toggle = useCallback(() => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    
    if (!newState) {
      stop();
    }
    
    return newState;
  }, [isEnabled, stop]);

  return {
    isEnabled,
    isSpeaking,
    volume,
    speak,
    stop,
    toggle,
    setVolume,
    setIsEnabled
  };
};