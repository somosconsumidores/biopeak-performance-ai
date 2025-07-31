import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWakeLock } from './useWakeLock';
import { useSessionPersistence } from './useSessionPersistence';
import { useHibernationDetection } from './useHibernationDetection';

export interface TrainingGoal {
  type: 'free_run' | 'target_distance' | 'target_pace' | 'target_duration' | 'target_calories';
  targetDistance?: number; // meters
  targetPace?: number; // min/km
  targetDuration?: number; // seconds
  targetCalories?: number;
}

export interface SessionData {
  sessionId: string;
  goal: TrainingGoal;
  startTime: Date;
  currentDistance: number;
  currentDuration: number;
  currentPace: number;
  currentHeartRate: number;
  averagePace: number;
  calories: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  lastSnapshot: Date;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
}

export const useRealtimeSession = () => {
  const { user } = useAuth();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<string>('');
  const [isWatchingLocation, setIsWatchingLocation] = useState(false);
  const [keepScreenOn, setKeepScreenOn] = useState(true);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [hibernationDuration, setHibernationDuration] = useState(0);
  
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<LocationData | null>(null);
  const distanceAccumulatorRef = useRef(0);
  const microDistanceAccumulatorRef = useRef(0);
  const lastSnapshotDistanceRef = useRef(0);
  const lastLocationTimestampRef = useRef<number>(Date.now());

  // Wake lock for keeping screen active
  const { isActive: isWakeLockActive } = useWakeLock({ 
    enabled: keepScreenOn && isRecording 
  });

  // Session persistence for recovery
  const { 
    pendingRecovery, 
    saveSessionState, 
    clearSavedSession 
  } = useSessionPersistence();

  // Hibernation detection
  const { isHibernated } = useHibernationDetection({
    onHibernation: (event) => {
      console.log('Hibernation detected:', event);
      // Save current state when hibernation is detected
      if (sessionData && isRecording) {
        saveSessionState(sessionData, isRecording, distanceAccumulatorRef.current);
      }
    },
    onRecovery: (event) => {
      console.log('Recovery from hibernation:', event);
      setHibernationDuration(event.duration);
    },
    threshold: 30000, // 30 seconds
  });

  // Calculate distance between two GPS points
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }, []);

  // Calculate calories (rough estimation)
  const calculateCalories = useCallback((distanceKm: number, durationMinutes: number, weight: number = 70): number => {
    // METs for running based on pace
    const paceMinKm = durationMinutes / distanceKm;
    let mets = 8; // Default moderate running
    
    if (paceMinKm <= 4) mets = 15; // Very fast
    else if (paceMinKm <= 5) mets = 12; // Fast
    else if (paceMinKm <= 6) mets = 10; // Moderate-fast
    else if (paceMinKm <= 7) mets = 8; // Moderate
    else mets = 6; // Slow

    return Math.round((mets * weight * durationMinutes) / 60);
  }, []);

  // Start GPS tracking
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported');
      return Promise.reject(new Error('Geolocalização não é suportada neste dispositivo.'));
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000
    };

    return new Promise<boolean>((resolve, reject) => {
      console.log('🎯 Iniciando GPS tracking...');
      console.log('🔍 Navegador suporta GPS:', !!navigator.geolocation);
      
      // First get current position to check permissions
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ GPS permission granted, starting tracking...');
          
          // Initialize location reference
          lastLocationRef.current = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            speed: position.coords.speed || undefined
          };
          
          // Now start watching position
          watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
              const newLocation: LocationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude || undefined,
                speed: position.coords.speed || undefined
              };

              console.log('📍 GPS Update:', newLocation);

              // Calculate distance from last position
              if (lastLocationRef.current) {
                const distance = calculateDistance(
                  lastLocationRef.current.latitude,
                  lastLocationRef.current.longitude,
                  newLocation.latitude,
                  newLocation.longitude
                );
                
                console.log(`🎯 GPS Movement detected: ${distance.toFixed(1)}m, accuracy: ${newLocation.accuracy.toFixed(1)}m`);
                
                // More permissive filter: use smaller threshold and cap at 3m
                const threshold = Math.min(newLocation.accuracy / 3, 3);
                
                if (distance > threshold) {
                  distanceAccumulatorRef.current += distance;
                  console.log(`📏 Distance updated: +${distance.toFixed(1)}m (total: ${distanceAccumulatorRef.current.toFixed(1)}m)`);
                } else if (distance > 1) {
                  // Accumulate micro-distances to avoid losing small movements
                  microDistanceAccumulatorRef.current += distance;
                  console.log(`🔍 Micro-distance accumulated: +${distance.toFixed(1)}m (micro total: ${microDistanceAccumulatorRef.current.toFixed(1)}m)`);
                  
                  // Add to main distance when micro-distance reaches 5m
                  if (microDistanceAccumulatorRef.current >= 5) {
                    distanceAccumulatorRef.current += microDistanceAccumulatorRef.current;
                    console.log(`📏 Micro-distance promoted: +${microDistanceAccumulatorRef.current.toFixed(1)}m (total: ${distanceAccumulatorRef.current.toFixed(1)}m)`);
                    microDistanceAccumulatorRef.current = 0;
                  }
                } else {
                  console.log(`❌ Movement too small: ${distance.toFixed(1)}m (threshold: ${threshold.toFixed(1)}m)`);
                }
                
                // Backup: Use GPS speed if available and no significant distance
                if (distance <= threshold && newLocation.speed && newLocation.speed > 0.5) {
                  const timeElapsed = (Date.now() - lastLocationTimestampRef.current) / 1000;
                  if (timeElapsed > 0) {
                    const speedDistance = newLocation.speed * timeElapsed;
                    if (speedDistance > 1) {
                      distanceAccumulatorRef.current += speedDistance;
                      console.log(`🚀 Speed-based distance: +${speedDistance.toFixed(1)}m from ${newLocation.speed.toFixed(1)}m/s over ${timeElapsed.toFixed(1)}s`);
                    }
                  }
                }
              }

              lastLocationRef.current = newLocation;
              lastLocationTimestampRef.current = Date.now();
            },
            (error) => {
              console.error('GPS Error during tracking:', error);
            },
            options
          );

          setIsWatchingLocation(true);
          resolve(true);
        },
        (error) => {
          console.error('🚨 GPS Permission Error:', error);
          console.error('🚨 Error code:', error.code);
          console.error('🚨 Error message:', error.message);
          let errorMessage = 'Erro desconhecido';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'LOCALIZAÇÃO DESABILITADA: Para usar o sistema de treino, você precisa habilitar a localização no seu navegador. Vá nas configurações do navegador e permita acesso à localização para este site.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Localização indisponível. Verifique se o GPS está ativo no seu dispositivo.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Tempo limite para obter localização. Tente novamente.';
              break;
          }
          
          console.error('GPS Error details:', errorMessage);
          reject(new Error(errorMessage));
        },
        options
      );
    });
  }, [calculateDistance]);

  // Stop GPS tracking
  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatchingLocation(false);
  }, []);

  // Create performance snapshot and check for AI coaching triggers
  const createSnapshot = useCallback(async (sessionData: SessionData, location: LocationData) => {
    if (!sessionData.sessionId) return;

    console.log('📊 Creating snapshot at:', {
      distance: sessionData.currentDistance,
      duration: sessionData.currentDuration,
      lastSnapshotDistance: lastSnapshotDistanceRef.current
    });

    const snapshotData = {
      session_id: sessionData.sessionId,
      snapshot_at_distance_meters: sessionData.currentDistance,
      snapshot_at_duration_seconds: sessionData.currentDuration,
      current_pace_min_km: sessionData.currentPace,
      current_heart_rate: sessionData.currentHeartRate,
      current_speed_ms: location.speed || null,
      elevation_meters: location.altitude || null,
      latitude: location.latitude,
      longitude: location.longitude,
      calories_burned_so_far: sessionData.calories,
      deviation_from_target: {
        distanceDeviation: sessionData.goal.targetDistance ? 
          sessionData.currentDistance - (sessionData.goal.targetDistance * (sessionData.currentDuration / (sessionData.goal.targetDuration || 1800))) : 0,
        paceDeviation: sessionData.goal.targetPace ? 
          sessionData.currentPace - sessionData.goal.targetPace : 0
      }
    };

    try {
      await supabase
        .from('performance_snapshots')
        .insert(snapshotData);

      // Enhanced AI coaching triggers:
      // 1. Initial feedback at 50m
      // 2. Regular feedback every 150m
      // 3. Time-based feedback every 2 minutes after the initial 30 seconds
      const distanceTrigger = (
        (sessionData.currentDistance >= 50 && lastSnapshotDistanceRef.current === 0) || // Initial feedback at 50m
        (sessionData.currentDistance - lastSnapshotDistanceRef.current >= 150) // Every 150m thereafter
      );
      
      const timeTrigger = (
        sessionData.currentDuration >= 30 && // After 30 seconds
        sessionData.currentDuration % 120 === 0 // Every 2 minutes
      );

      if (distanceTrigger || timeTrigger) {
        console.log('🤖 [AI COACH DEBUG] Triggering AI coaching:', { 
          distanceTrigger, 
          timeTrigger, 
          distance: sessionData.currentDistance,
          duration: sessionData.currentDuration,
          lastSnapshotDistance: lastSnapshotDistanceRef.current
        });
        
        lastSnapshotDistanceRef.current = sessionData.currentDistance;
        await requestAIFeedback(sessionData, snapshotData);
      } else {
        console.log('🤖 [AI COACH DEBUG] No trigger conditions met:', {
          distance: sessionData.currentDistance,
          duration: sessionData.currentDuration,
          lastSnapshotDistance: lastSnapshotDistanceRef.current,
          distanceCheck: sessionData.currentDistance - lastSnapshotDistanceRef.current,
          timeCheck: sessionData.currentDuration % 120
        });
      }
    } catch (error) {
      console.error('Error creating snapshot:', error);
    }
  }, []);

  // Request AI feedback with enhanced logging
  const requestAIFeedback = useCallback(async (sessionData: SessionData, performanceData: any) => {
    console.log('🤖 Requesting AI feedback for session:', sessionData.sessionId);
    console.log('📊 Performance data:', performanceData);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-coaching-engine', {
        body: {
          sessionId: sessionData.sessionId,
          goal: sessionData.goal,
          currentPerformance: performanceData,
          sessionProgress: {
            distance: sessionData.currentDistance,
            duration: sessionData.currentDuration,
            pace: sessionData.currentPace,
            heartRate: sessionData.currentHeartRate
          }
        }
      });

      console.log('🤖 AI Coach response:', { data, error });

      if (error) {
        console.error('❌ AI Coach error:', error);
        throw error;
      }

      if (data?.feedback) {
        console.log('💬 AI Feedback received:', data.feedback);
        setLastFeedback(data.feedback);
        
        // Speak feedback if TTS is available
        if ('speechSynthesis' in window) {
          console.log('🔊 Speaking AI feedback');
          speechSynthesis.cancel(); // Cancel any ongoing speech
          const utterance = new SpeechSynthesisUtterance(data.feedback);
          utterance.rate = 0.9;
          utterance.pitch = 1;
          utterance.lang = 'pt-BR'; // Set Portuguese
          speechSynthesis.speak(utterance);
        } else {
          console.warn('🔇 Speech synthesis not available');
        }
      } else {
        console.warn('⚠️ No feedback received from AI Coach');
      }
    } catch (error) {
      console.error('❌ Error requesting AI feedback:', error);
    }
  }, []);

  // Start training session
  const startSession = useCallback(async (goal: TrainingGoal) => {
    if (!user) return null;

    try {
      console.log('🚀 [AI COACH DEBUG] Starting new training session...');
      console.log('🎯 [AI COACH DEBUG] Goal:', goal);
      
      // Reset distance accumulator for new session
      distanceAccumulatorRef.current = 0;
      lastSnapshotDistanceRef.current = 0;
      lastLocationRef.current = null;
      
      // Create session in database
      const { data: session, error } = await supabase
        .from('training_sessions')
        .insert({
          user_id: user.id,
          session_type: goal.type,
          goal_data: goal as any,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      const newSessionData: SessionData = {
        sessionId: session.id,
        goal,
        startTime: new Date(),
        currentDistance: 0,
        currentDuration: 0,
        currentPace: 0,
        currentHeartRate: 0,
        averagePace: 0,
        calories: 0,
        status: 'active',
        lastSnapshot: new Date()
      };

      setSessionData(newSessionData);
      
      // Start GPS tracking - this will throw an error if it fails
      await startLocationTracking();
      console.log('✅ GPS tracking started successfully');

      // Start interval for updating session data
      intervalRef.current = setInterval(() => {
        setSessionData(current => {
          if (!current || !lastLocationRef.current) return current;

          const now = new Date();
          const durationSeconds = Math.floor((now.getTime() - current.startTime.getTime()) / 1000);
          const distanceKm = distanceAccumulatorRef.current / 1000;
          const currentPace = durationSeconds > 0 && distanceKm > 0 ? (durationSeconds / 60) / distanceKm : 0;
          const calories = calculateCalories(distanceKm, durationSeconds / 60);

          const updated = {
            ...current,
            currentDistance: distanceAccumulatorRef.current,
            currentDuration: durationSeconds,
            currentPace,
            averagePace: currentPace, // Simplified - could be more sophisticated
            calories,
            lastSnapshot: now
          };

          // Create snapshot more frequently during active sessions
          if (lastLocationRef.current && (now.getTime() - current.lastSnapshot.getTime()) > 15000) { // Every 15 seconds
            console.log('⏰ Creating scheduled snapshot');
            createSnapshot(updated, lastLocationRef.current);
          }

          return updated;
        });
      }, 1000);

      setIsRecording(true);
      console.log('🎯 Training session started with ID:', session.id);
      return session.id;
    } catch (error) {
      console.error('❌ Error starting session:', error);
      
      // Clean up if session creation failed
      setSessionData(null);
      setIsRecording(false);
      stopLocationTracking();
      
      // Re-throw the error so it can be caught by the UI
      throw error;
    }
  }, [user, startLocationTracking, calculateCalories, createSnapshot, stopLocationTracking]);

  // Pause session
  const pauseSession = useCallback(async () => {
    if (!sessionData) return;

    setIsRecording(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    try {
      await supabase
        .from('training_sessions')
        .update({ status: 'paused' })
        .eq('id', sessionData.sessionId);

      setSessionData(current => current ? { ...current, status: 'paused' } : null);
    } catch (error) {
      console.error('Error pausing session:', error);
    }
  }, [sessionData]);

  // Resume session
  const resumeSession = useCallback(async () => {
    if (!sessionData) return;

    setIsRecording(true);
    
    // Restart interval
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setSessionData(current => {
          if (!current || !lastLocationRef.current) return current;

          const now = new Date();
          const durationSeconds = Math.floor((now.getTime() - current.startTime.getTime()) / 1000);
          const distanceKm = distanceAccumulatorRef.current / 1000;
          const currentPace = durationSeconds > 0 && distanceKm > 0 ? (durationSeconds / 60) / distanceKm : 0;
          const calories = calculateCalories(distanceKm, durationSeconds / 60);

          return {
            ...current,
            currentDistance: distanceAccumulatorRef.current,
            currentDuration: durationSeconds,
            currentPace,
            averagePace: currentPace,
            calories,
            lastSnapshot: now
          };
        });
      }, 1000);
    }

    try {
      await supabase
        .from('training_sessions')
        .update({ status: 'active' })
        .eq('id', sessionData.sessionId);

      setSessionData(current => current ? { ...current, status: 'active' } : null);
    } catch (error) {
      console.error('Error resuming session:', error);
    }
  }, [sessionData, calculateCalories]);

  // Complete session
  const completeSession = useCallback(async (subjectiveFeedback?: any) => {
    if (!sessionData) return;

    setIsRecording(false);
    stopLocationTracking();
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    try {
      const goalAchieved = checkGoalAchievement(sessionData);
      
      console.log('🏁 Completing session:', sessionData.sessionId);
      console.log('📊 Session data:', {
        distance: sessionData.currentDistance,
        duration: sessionData.currentDuration,
        pace: sessionData.averagePace,
        calories: sessionData.calories
      });
      
      const { data, error } = await supabase
        .from('training_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_distance_meters: sessionData.currentDistance,
          total_duration_seconds: sessionData.currentDuration,
          average_pace_min_km: sessionData.averagePace,
          calories_burned: sessionData.calories,
          goal_achieved: goalAchieved,
          subjective_feedback: subjectiveFeedback
        })
        .eq('id', sessionData.sessionId);

      if (error) {
        console.error('❌ Error updating session:', error);
        throw error;
      }
      
      console.log('✅ Session completed successfully:', data);
      setSessionData(current => current ? { ...current, status: 'completed' } : null);
    } catch (error) {
      console.error('Error completing session:', error);
      throw error; // Re-throw to allow TrainingSession component to handle
    }
  }, [sessionData, stopLocationTracking]);

  // Check if goal was achieved
  const checkGoalAchievement = useCallback((session: SessionData): boolean => {
    const { goal } = session;
    
    switch (goal.type) {
      case 'target_distance':
        return goal.targetDistance ? session.currentDistance >= goal.targetDistance : false;
      case 'target_duration':
        return goal.targetDuration ? session.currentDuration >= goal.targetDuration : false;
      case 'target_calories':
        return goal.targetCalories ? session.calories >= goal.targetCalories : false;
      case 'target_pace':
        return goal.targetPace ? session.averagePace <= goal.targetPace : false;
      default:
        return true; // Free run is always "achieved"
    }
  }, []);

  // Check for pending recovery on mount
  useEffect(() => {
    if (pendingRecovery && !sessionData) {
      setShowRecoveryDialog(true);
      setHibernationDuration(Date.now() - pendingRecovery.timestamp);
    }
  }, [pendingRecovery, sessionData]);

  // Save session state periodically
  useEffect(() => {
    if (sessionData && isRecording) {
      const saveInterval = setInterval(() => {
        saveSessionState(sessionData, isRecording, distanceAccumulatorRef.current);
      }, 10000); // Save every 10 seconds

      return () => clearInterval(saveInterval);
    }
  }, [sessionData, isRecording, saveSessionState]);

  // Recover session function
  const recoverSession = useCallback(() => {
    if (!pendingRecovery) return;

    const { sessionData: recoveredData, lastSavedDistance } = pendingRecovery;
    
    // Restore session data
    setSessionData(recoveredData);
    distanceAccumulatorRef.current = lastSavedDistance;
    
    // Resume recording if it was active
    if (pendingRecovery.wasRecording) {
      setIsRecording(true);
      startLocationTracking().catch(console.error);
      
      // Restart the update interval
      intervalRef.current = setInterval(() => {
        setSessionData(current => {
          if (!current || !lastLocationRef.current) return current;

          const now = new Date();
          const durationSeconds = Math.floor((now.getTime() - current.startTime.getTime()) / 1000);
          const distanceKm = distanceAccumulatorRef.current / 1000;
          const currentPace = durationSeconds > 0 && distanceKm > 0 ? (durationSeconds / 60) / distanceKm : 0;
          const calories = calculateCalories(distanceKm, durationSeconds / 60);

          return {
            ...current,
            currentDistance: distanceAccumulatorRef.current,
            currentDuration: durationSeconds,
            currentPace,
            averagePace: currentPace,
            calories,
            lastSnapshot: now
          };
        });
      }, 1000);
    }

    setShowRecoveryDialog(false);
    clearSavedSession();
  }, [pendingRecovery, clearSavedSession, startLocationTracking, calculateCalories]);

  // Discard recovered session
  const discardRecoveredSession = useCallback(() => {
    setShowRecoveryDialog(false);
    clearSavedSession();
  }, [clearSavedSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLocationTracking();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [stopLocationTracking]);

  return {
    sessionData,
    isRecording,
    isWatchingLocation,
    lastFeedback,
    keepScreenOn,
    setKeepScreenOn,
    isWakeLockActive,
    showRecoveryDialog,
    hibernationDuration,
    pendingRecovery,
    isHibernated,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    recoverSession,
    discardRecoveredSession,
  };
};