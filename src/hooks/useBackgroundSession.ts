import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';
import { useBackgroundGPS } from './useBackgroundGPS';
import { useBackgroundCoach } from './useBackgroundCoach';
import { TrainingGoal, LocationData } from './useRealtimeSession';

// Extended SessionData for background functionality
interface SessionData {
  id: string;
  sessionId?: string;
  goal?: TrainingGoal;
  startTime: Date;
  distance: number;
  duration: number;
  pace: number;
  calories: number;
  currentLocation: LocationData | null;
  locations: LocationData[];
  snapshots: any[];
  isRecording: boolean;
  isPaused: boolean;
  currentDistance?: number;
  currentDuration?: number;
  currentPace?: number;
  averagePace?: number;
  currentHeartRate?: number;
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
  lastSnapshot?: Date;
}

interface BackgroundSessionOptions {
  goal?: TrainingGoal;
  enableCoaching?: boolean;
  notificationConfig?: {
    title?: string;
    text?: string;
    icon?: string;
  };
}

interface BackgroundSessionState {
  isActive: boolean;
  isSupported: boolean;
  sessionData: SessionData | null;
  error: string | null;
  foregroundServiceId: number | null;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

const calculatePace = (distance: number, duration: number): number => {
  if (distance === 0) return 0;
  return (duration / 60) / (distance / 1000); // min/km
};

const calculateCalories = (distance: number, pace: number, weight: number = 70): number => {
  // Simplified calorie calculation
  const met = pace > 6 ? 8.3 : pace > 5 ? 9.8 : 11.0; // METs based on pace
  const durationHours = (distance / 1000) / (60 / pace);
  return met * weight * durationHours;
};

export const useBackgroundSession = (options: BackgroundSessionOptions = {}) => {
  const [state, setState] = useState<BackgroundSessionState>({
    isActive: false,
    isSupported: false,
    sessionData: null,
    error: null,
    foregroundServiceId: null,
  });

  const sessionDataRef = useRef<SessionData | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastLocationRef = useRef<LocationData | null>(null);
  const snapshotIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Background GPS hook
  const backgroundGPS = useBackgroundGPS({
    enableHighAccuracy: true,
    distanceFilter: 5,
    interval: 3000,
    onLocationUpdate: handleLocationUpdate,
    onError: (error) => setState(prev => ({ ...prev, error })),
  });

  // Background coaching hook
  const backgroundCoach = useBackgroundCoach({
    enabled: options.enableCoaching ?? true,
    goal: options.goal,
  });

  // Check if background session is supported
  useEffect(() => {
    const isSupported = Capacitor.isNativePlatform();
    setState(prev => ({ ...prev, isSupported }));
  }, []);

  function handleLocationUpdate(location: LocationData) {
    if (!sessionDataRef.current || !startTimeRef.current) return;

    const now = Date.now();
    const duration = Math.floor((now - startTimeRef.current) / 1000);

    let newDistance = sessionDataRef.current.distance;
    let newPace = sessionDataRef.current.pace;

    // Calculate distance if we have a previous location
    if (lastLocationRef.current) {
      const distanceIncrement = calculateDistance(
        lastLocationRef.current.latitude,
        lastLocationRef.current.longitude,
        location.latitude,
        location.longitude
      );
      newDistance += distanceIncrement;
    }

    // Calculate pace
    newPace = calculatePace(newDistance, duration);

    // Calculate calories
    const newCalories = calculateCalories(newDistance, newPace);

    // Update session data
    const updatedSessionData: SessionData = {
      ...sessionDataRef.current,
      distance: newDistance,
      duration,
      pace: newPace,
      calories: newCalories,
      currentLocation: location,
      locations: [...sessionDataRef.current.locations, location],
    };

    sessionDataRef.current = updatedSessionData;
    setState(prev => ({ ...prev, sessionData: updatedSessionData }));
    lastLocationRef.current = location;

    // Update foreground notification
    updateForegroundNotification(updatedSessionData);

    // Trigger coaching if enabled
    if (options.enableCoaching) {
      backgroundCoach.analyzePerformance(updatedSessionData);
    }
  }

  const updateForegroundNotification = useCallback(async (sessionData: SessionData) => {
    if (!state.foregroundServiceId || !Capacitor.isNativePlatform()) return;

    try {
      const distanceKm = (sessionData.distance / 1000).toFixed(2);
      const durationMin = Math.floor(sessionData.duration / 60);
      const durationSec = sessionData.duration % 60;
      const paceFormatted = sessionData.pace.toFixed(1);

      // Update notification if supported
      console.log(`Atualização: ${distanceKm}km - Pace: ${paceFormatted} min/km - Calorias: ${Math.round(sessionData.calories)}`);
    } catch (error) {
      console.error('Erro ao atualizar notificação:', error);
    }
  }, [state.foregroundServiceId]);

  const startBackgroundSession = useCallback(async (goal?: TrainingGoal) => {
    if (!state.isSupported) {
      throw new Error('Sessão em background não é suportada neste dispositivo');
    }

    if (state.isActive) {
      console.warn('Sessão em background já está ativa');
      return;
    }

    try {
      // Start foreground service (simplified for now)
      console.log('Iniciando serviço em background:', {
        title: options.notificationConfig?.title || 'BioPeak - Treino Ativo',
        text: options.notificationConfig?.text || 'Iniciando rastreamento...',
      });
      
      const serviceId = Date.now();

      // Initialize session data
      const initialSessionData: SessionData = {
        id: `session_${Date.now()}`,
        distance: 0,
        duration: 0,
        pace: 0,
        calories: 0,
        startTime: new Date(),
        goal,
        locations: [],
        currentLocation: null,
        snapshots: [],
        isRecording: true,
        isPaused: false,
      };

      sessionDataRef.current = initialSessionData;
      startTimeRef.current = Date.now();
      lastLocationRef.current = null;

      // Start background GPS
      await backgroundGPS.startTracking();

      // Start coaching if enabled
      if (options.enableCoaching && goal) {
        backgroundCoach.startCoaching(goal);
      }

      // Start periodic snapshots
      snapshotIntervalRef.current = setInterval(() => {
        if (sessionDataRef.current) {
          // Save session data to localStorage
          localStorage.setItem('backgroundSession', JSON.stringify({
            ...sessionDataRef.current,
            lastSaved: Date.now(),
          }));
        }
      }, 10000); // Save every 10 seconds

      setState(prev => ({
        ...prev,
        isActive: true,
        sessionData: initialSessionData,
        foregroundServiceId: serviceId,
        error: null,
      }));

      console.log('Sessão em background iniciada com sucesso');
    } catch (error) {
      console.error('Erro ao iniciar sessão em background:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }));
      throw error;
    }
  }, [state.isSupported, state.isActive, options, backgroundGPS, backgroundCoach]);

  const pauseBackgroundSession = useCallback(async () => {
    if (!state.isActive || !sessionDataRef.current) return;

    try {
      // Update session data
      sessionDataRef.current = {
        ...sessionDataRef.current,
        isPaused: true,
      };

      setState(prev => ({
        ...prev,
        sessionData: sessionDataRef.current,
      }));

        // Update notification
        if (state.foregroundServiceId) {
          console.log('Treino pausado - Toque para retomar');
        }

      // Stop coaching
      backgroundCoach.pauseCoaching();

      console.log('Sessão em background pausada');
    } catch (error) {
      console.error('Erro ao pausar sessão:', error);
    }
  }, [state.isActive, state.foregroundServiceId, backgroundCoach]);

  const resumeBackgroundSession = useCallback(async () => {
    if (!state.isActive || !sessionDataRef.current) return;

    try {
      // Update session data
      sessionDataRef.current = {
        ...sessionDataRef.current,
        isPaused: false,
      };

      setState(prev => ({
        ...prev,
        sessionData: sessionDataRef.current,
      }));

      // Resume coaching
      if (sessionDataRef.current.goal) {
        backgroundCoach.resumeCoaching();
      }

      console.log('Sessão em background retomada');
    } catch (error) {
      console.error('Erro ao retomar sessão:', error);
    }
  }, [state.isActive, backgroundCoach]);

  const stopBackgroundSession = useCallback(async () => {
    if (!state.isActive) return;

    try {
      // Stop background GPS
      await backgroundGPS.stopTracking();

      // Stop coaching
      backgroundCoach.stopCoaching();

      // Clear snapshot interval
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
        snapshotIntervalRef.current = null;
      }

      // Stop foreground service
      if (state.foregroundServiceId) {
        console.log('Parando serviço em background');
      }

      // Save final session data
      if (sessionDataRef.current) {
        localStorage.setItem('completedBackgroundSession', JSON.stringify({
          ...sessionDataRef.current,
          endTime: new Date(),
          completedAt: Date.now(),
        }));
      }

      // Clear localStorage
      localStorage.removeItem('backgroundSession');

      // Reset state
      setState(prev => ({
        ...prev,
        isActive: false,
        foregroundServiceId: null,
      }));

      sessionDataRef.current = null;
      startTimeRef.current = null;
      lastLocationRef.current = null;

      console.log('Sessão em background finalizada');
    } catch (error) {
      console.error('Erro ao parar sessão:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Erro ao finalizar sessão' 
      }));
    }
  }, [state.isActive, state.foregroundServiceId, backgroundGPS, backgroundCoach]);

  const recoverBackgroundSession = useCallback(() => {
    try {
      const savedSession = localStorage.getItem('backgroundSession');
      if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        sessionDataRef.current = sessionData;
        setState(prev => ({ ...prev, sessionData }));
        return sessionData;
      }
    } catch (error) {
      console.error('Erro ao recuperar sessão:', error);
    }
    return null;
  }, []);

  // Initialize recovery on mount
  useEffect(() => {
    recoverBackgroundSession();
  }, [recoverBackgroundSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
      }
    };
  }, []);

  return {
    ...state,
    backgroundGPS,
    backgroundCoach,
    startBackgroundSession,
    pauseBackgroundSession,
    resumeBackgroundSession,
    stopBackgroundSession,
    recoverBackgroundSession,
  };
};