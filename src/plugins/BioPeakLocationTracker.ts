import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface LocationUpdateData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  distance: number;
  totalDistance: number;
  timestamp: number;
}

export interface BioPeakLocationTrackerPlugin {
  startLocationTracking(): Promise<{ success: boolean; message: string }>;
  stopLocationTracking(): Promise<{ success: boolean; message: string; finalDistance: number }>;
  getAccumulatedDistance(): Promise<{ distance: number }>;
  resetDistance(): Promise<{ success: boolean }>;
  configureFeedback(options: {
    sessionId: string;
    trainingGoal?: string;
    enabled: boolean;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    userToken?: string;
    testInterval?: number; // Optional: for testing (e.g., 50 instead of 500)
  }): Promise<{ success: boolean }>;
  generateCompletionAudio(): Promise<{ success: boolean; message: string }>;
  cleanup(): Promise<{ success: boolean }>;
  addListener(
    eventName: 'locationUpdate',
    listenerFunc: (data: LocationUpdateData) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'locationError',
    listenerFunc: (data: { error: string }) => void
  ): Promise<PluginListenerHandle>;
}

const BioPeakLocationTracker = registerPlugin<BioPeakLocationTrackerPlugin>('BioPeakLocationTracker', {
  web: () => ({
    startLocationTracking: async () => ({ success: false, message: 'Not supported on web' }),
    stopLocationTracking: async () => ({ success: false, message: 'Not supported on web', finalDistance: 0 }),
    getAccumulatedDistance: async () => ({ distance: 0 }),
    resetDistance: async () => ({ success: false }),
    configureFeedback: async () => ({ success: false }),
    generateCompletionAudio: async () => ({ success: false, message: 'Not supported on web' }),
    cleanup: async () => ({ success: false }),
    addListener: async () => ({ remove: async () => {} }),
  }),
});

export { BioPeakLocationTracker };
