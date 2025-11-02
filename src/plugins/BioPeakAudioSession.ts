import { registerPlugin } from '@capacitor/core';

export interface BioPeakAudioSessionPlugin {
  startAudioSession(): Promise<{ success: boolean; message: string }>;
  stopAudioSession(): Promise<{ success: boolean; message: string }>;
  setAudioCategory(options: {
    category: 'playback' | 'record' | 'playAndRecord';
    options?: string[];
  }): Promise<{ success: boolean; category: string; options: string[] }>;
  startSilentAudio(): Promise<{ success: boolean; message: string }>;
  stopSilentAudio(): Promise<{ success: boolean; message: string }>;
  playAudioFile(options: { url: string }): Promise<{ success: boolean; message: string; duration?: number }>;
  stopFeedbackAudio(): Promise<{ success: boolean }>;
}

const BioPeakAudioSession = registerPlugin<BioPeakAudioSessionPlugin>('BioPeakAudioSession', {
  web: () => ({
    startAudioSession: async () => ({ success: false, message: 'Not supported on web' }),
    stopAudioSession: async () => ({ success: false, message: 'Not supported on web' }),
    setAudioCategory: async () => ({ success: false, category: '', options: [] }),
    startSilentAudio: async () => ({ success: false, message: 'Not supported on web' }),
    stopSilentAudio: async () => ({ success: false, message: 'Not supported on web' }),
    playAudioFile: async () => ({ success: false, message: 'Not supported on web' }),
    stopFeedbackAudio: async () => ({ success: false }),
  }),
});

export { BioPeakAudioSession };
