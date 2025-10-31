import { registerPlugin } from '@capacitor/core';

export interface BioPeakAudioSessionPlugin {
  startAudioSession(): Promise<{ success: boolean; message: string }>;
  stopAudioSession(): Promise<{ success: boolean; message: string }>;
  setAudioCategory(options: {
    category: 'playback' | 'record' | 'playAndRecord';
    options?: string[];
  }): Promise<{ success: boolean; category: string; options: string[] }>;
}

const BioPeakAudioSession = registerPlugin<BioPeakAudioSessionPlugin>('BioPeakAudioSession', {
  web: () => ({
    startAudioSession: async () => ({ success: false, message: 'Not supported on web' }),
    stopAudioSession: async () => ({ success: false, message: 'Not supported on web' }),
    setAudioCategory: async () => ({ success: false, category: '', options: [] }),
  }),
});

export { BioPeakAudioSession };
