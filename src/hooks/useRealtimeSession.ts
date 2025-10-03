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
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gpsPermissionStatus, setGpsPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  
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

  // Detect if running in development or emulator
  const isEmulatorOrDev = useCallback((): boolean => {
    const userAgent = navigator.userAgent.toLowerCase();
    const hostname = window.location.hostname;
    
    // Check for common emulator indicators
    const emulatorIndicators = [
      'android emulator',
      'genymotion',
      'bluestacks',
      'localhost',
      '127.0.0.1',
      '.local',
      'dev',
      'test'
    ];
    
    return emulatorIndicators.some(indicator => 
      userAgent.includes(indicator) || hostname.includes(indicator)
    ) || hostname === 'localhost' || hostname.startsWith('192.168.');
  }, []);

  // Check GPS permission status
  const checkGPSPermission = useCallback(async (): Promise<'granted' | 'denied' | 'prompt'> => {
    if (!navigator.permissions) {
      return 'prompt'; // Assume prompt if permissions API is not available
    }
    
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return permission.state;
    } catch (error) {
      console.warn('Error checking GPS permission:', error);
      return 'prompt';
    }
  }, []);

  // Simulate GPS movement for development/testing
  const startSimulationMode = useCallback(() => {
    console.log('🧪 Starting GPS simulation mode for development');
    setIsSimulationMode(true);
    setLocationError(null);
    
    // Starting location (São Paulo, Brazil)
    let currentLat = -23.5505;
    let currentLng = -46.6333;
    let totalDistance = 0;
    
    lastLocationRef.current = {
      latitude: currentLat,
      longitude: currentLng,
      accuracy: 5,
      altitude: 750,
      speed: 2.5 // 2.5 m/s = ~9 km/h
    };
    
    const simulationInterval = setInterval(() => {
      // Simulate movement in a random direction
      const bearing = Math.random() * 360;
      const distance = 2.5 + Math.random() * 2.5; // 2.5-5m per second
      
      // Convert bearing and distance to lat/lng change
      const latChange = (distance * Math.cos(bearing * Math.PI / 180)) / 111320;
      const lngChange = (distance * Math.sin(bearing * Math.PI / 180)) / (111320 * Math.cos(currentLat * Math.PI / 180));
      
      currentLat += latChange;
      currentLng += lngChange;
      totalDistance += distance;
      
      distanceAccumulatorRef.current = totalDistance;
      
      const newLocation: LocationData = {
        latitude: currentLat,
        longitude: currentLng,
        accuracy: 3 + Math.random() * 2,
        altitude: 750 + Math.random() * 10,
        speed: 2.5 + Math.random() * 1.5
      };
      
      lastLocationRef.current = newLocation;
      lastLocationTimestampRef.current = Date.now();
      
      console.log('🧪 Simulated GPS Update:', newLocation, `Total distance: ${totalDistance.toFixed(1)}m`);
    }, 1000);
    
    // Store simulation interval for cleanup
    watchIdRef.current = simulationInterval as any;
    setIsWatchingLocation(true);
    
    return Promise.resolve(true);
  }, []);

  // Enhanced GPS troubleshooting
  const diagnoseProblem = useCallback(async (): Promise<string> => {
    const isEmulator = isEmulatorOrDev();
    const permission = await checkGPSPermission();
    const hasGeolocation = 'geolocation' in navigator;
    const isHttps = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost';
    
    let diagnosis = '🔍 DIAGNÓSTICO GPS:\n\n';
    
    if (!hasGeolocation) {
      diagnosis += '❌ Navegador não suporta geolocalização\n';
      diagnosis += '💡 Solução: Use um navegador moderno (Chrome, Firefox, Safari)\n\n';
      return diagnosis;
    }
    
    if (!isHttps && !isLocalhost) {
      diagnosis += '❌ Geolocalização requer HTTPS\n';
      diagnosis += '💡 Solução: Acesse o site via HTTPS\n\n';
    }
    
    if (isEmulator) {
      diagnosis += '📱 EMULADOR DETECTADO\n';
      diagnosis += '💡 Soluções para Emulador:\n';
      diagnosis += '  1. Abra Extended Controls (⋯) → Location\n';
      diagnosis += '  2. Defina coordenadas manualmente\n';
      diagnosis += '  3. Ative GPS nas configurações do Android\n';
      diagnosis += '  4. Use modo simulação do BioPeak\n\n';
    }
    
    switch (permission) {
      case 'denied':
        diagnosis += '❌ Permissão de localização NEGADA\n';
        diagnosis += '💡 Soluções:\n';
        diagnosis += '  1. Clique no ícone 🔒 na barra de endereços\n';
        diagnosis += '  2. Permita acesso à localização\n';
        diagnosis += '  3. Recarregue a página\n\n';
        break;
      case 'prompt':
        diagnosis += '⚠️ Permissão de localização pendente\n';
        diagnosis += '💡 Aceite quando o navegador solicitar\n\n';
        break;
      case 'granted':
        diagnosis += '✅ Permissão de localização concedida\n\n';
        break;
    }
    
    return diagnosis;
  }, [isEmulatorOrDev, checkGPSPermission]);

  // Enhanced GPS tracking with fallback to simulation
  const startLocationTracking = useCallback(async () => {
    console.log('🎯 Iniciando GPS tracking...');
    setLocationError(null);
    
    // Check if running in emulator/dev environment
    const isEmulator = isEmulatorOrDev();
    const permission = await checkGPSPermission();
    
    console.log('🔍 Environment check:', { isEmulator, permission });
    setGpsPermissionStatus(permission as any);

    // If permission is denied or in emulator, offer simulation mode
    if (permission === 'denied' || isEmulator) {
      const diagnosis = await diagnoseProblem();
      console.log('🔧 GPS Problem diagnosed:', diagnosis);
      setLocationError(diagnosis);
      
      // Auto-start simulation mode in emulator or dev environment
      if (isEmulator) {
        console.log('🧪 Auto-starting simulation mode for emulator/dev');
        return startSimulationMode();
      }
      
      return Promise.reject(new Error('Permissão de localização negada. Use o modo simulação ou configure as permissões.'));
    }

    if (!navigator.geolocation) {
      const error = 'Geolocalização não é suportada neste dispositivo.';
      setLocationError(error);
      return Promise.reject(new Error(error));
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000, // Increased timeout for better emulator compatibility
      maximumAge: 1000
    };

    return new Promise<boolean>((resolve, reject) => {
      console.log('🔍 Navegador suporta GPS:', !!navigator.geolocation);
      
      // First get current position to check permissions
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ GPS permission granted, starting tracking...');
          setLocationError(null);
          setGpsPermissionStatus('granted');
          setIsSimulationMode(false);
          
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
              // For emulator environments, fall back to simulation on tracking error
              if (isEmulator) {
                console.log('🧪 GPS tracking failed in emulator, falling back to simulation');
                startSimulationMode();
              }
            },
            options
          );

          setIsWatchingLocation(true);
          resolve(true);
        },
        async (error) => {
          console.error('🚨 GPS Permission Error:', error);
          console.error('🚨 Error code:', error.code);
          console.error('🚨 Error message:', error.message);
          
          const diagnosis = await diagnoseProblem();
          setLocationError(diagnosis);
          setGpsPermissionStatus('denied');
          
          let errorMessage = 'Erro de localização';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = isEmulator 
                ? 'GPS não configurado no emulador. Tentando modo simulação...' 
                : 'Permissão de localização negada. Configure as permissões do navegador.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = isEmulator 
                ? 'GPS indisponível no emulador. Usando modo simulação...' 
                : 'Localização indisponível. Verifique se o GPS está ativo.';
              break;
            case error.TIMEOUT:
              errorMessage = isEmulator 
                ? 'GPS timeout no emulador. Usando modo simulação...' 
                : 'Tempo limite para obter localização. Tente novamente.';
              break;
          }
          
          // Auto-fallback to simulation in emulator environments
          if (isEmulator) {
            console.log('🧪 Auto-fallback to simulation mode for emulator');
            try {
              await startSimulationMode();
              resolve(true);
              return;
            } catch (simError) {
              console.error('Simulation mode failed:', simError);
            }
          }
          
          console.error('GPS Error details:', errorMessage);
          reject(new Error(errorMessage));
        },
        options
      );
    });
  }, [calculateDistance, isEmulatorOrDev, checkGPSPermission, diagnoseProblem, startSimulationMode]);

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

      // Update the session's lastSnapshot time ONLY after successful snapshot creation
      setSessionData(current => current ? { ...current, lastSnapshot: new Date() } : current);

      // Enhanced AI coaching triggers:
      // 1. Initial feedback at 50m
      // 2. Regular feedback every 150m
      // 3. Time-based feedback every 2 minutes after the initial 30 seconds
      const distanceTrigger = (
        (sessionData.currentDistance >= 10 && lastSnapshotDistanceRef.current === 0) || // Initial feedback at 10m (reduced for testing)
        (sessionData.currentDistance - lastSnapshotDistanceRef.current >= 20) // Every 20m thereafter (reduced for testing)
      );
      
      const timeTrigger = (
        sessionData.currentDuration >= 10 && // After 10 seconds (reduced for testing)
        sessionData.currentDuration % 30 === 0 // Every 30 seconds (reduced for testing)
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
        
        // Enhanced TTS with better voice quality
        try {
          console.log('🔊 Speaking AI feedback with enhanced TTS');
          const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
            body: { 
              text: data.feedback, 
              voice: 'alloy',
              speed: 1.0
            }
          });

          if (ttsError || !ttsData?.audioContent) {
            console.warn('⚠️ Enhanced TTS failed, falling back to native:', ttsError);
            // Fallback to native TTS
            if ('speechSynthesis' in window) {
              speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(data.feedback);
              utterance.rate = 0.9;
              utterance.pitch = 1;
              utterance.lang = 'pt-BR';
              speechSynthesis.speak(utterance);
            }
          } else {
            // Play enhanced TTS audio
            const binaryString = atob(ttsData.audioContent);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.volume = 0.8;
            audio.play().finally(() => URL.revokeObjectURL(audioUrl));
          }
        } catch (error) {
          console.error('❌ TTS Error:', error);
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
          // Ensure startTime is a Date object (it might come as string from recovery)
          const startTime = current.startTime instanceof Date ? current.startTime : new Date(current.startTime);
          const durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
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
            // DO NOT update lastSnapshot here - only in createSnapshot function
          };

          // Create snapshot more frequently during active sessions
          // Ensure lastSnapshot is a Date object too
          const lastSnapshot = current.lastSnapshot instanceof Date ? current.lastSnapshot : new Date(current.lastSnapshot);
          const timeSinceLastSnapshot = now.getTime() - lastSnapshot.getTime();
          
          console.log('⏰ [AI COACH DEBUG] Snapshot timing check:', {
            hasLocation: !!lastLocationRef.current,
            timeSinceLastSnapshot,
            threshold: 5000,
            lastSnapshotDate: lastSnapshot.toISOString(),
            currentDate: now.toISOString()
          });
          
          if (lastLocationRef.current && timeSinceLastSnapshot > 5000) { // Every 5 seconds for testing
            console.log('⏰ [AI COACH DEBUG] Creating scheduled snapshot');
            console.log('📊 [AI COACH DEBUG] Session data for snapshot:', updated);
            console.log('📍 [AI COACH DEBUG] Location for snapshot:', lastLocationRef.current);
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
          // Ensure startTime is a Date object (it might come as string from recovery)
          const startTime = current.startTime instanceof Date ? current.startTime : new Date(current.startTime);
          const durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
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
            // DO NOT update lastSnapshot here - only in createSnapshot function
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

  // Complete session
  const completeSession = useCallback(async (subjectiveFeedback?: any) => {
    if (!sessionData) {
      console.error('❌ Cannot complete session: sessionData is null');
      throw new Error('Dados da sessão não encontrados');
    }

    console.log('🏁 Starting session completion...');
    console.log('📊 Session ID:', sessionData.sessionId);
    console.log('📊 Session data before completion:', {
      distance: sessionData.currentDistance,
      duration: sessionData.currentDuration,
      pace: sessionData.averagePace,
      calories: sessionData.calories,
      status: sessionData.status
    });

    setIsRecording(false);
    stopLocationTracking();
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    try {
      const goalAchieved = checkGoalAchievement(sessionData);
      
      console.log('🎯 Goal achieved:', goalAchieved);
      console.log('💾 Updating training_sessions table...');
      
      const updateData = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_distance_meters: sessionData.currentDistance,
        total_duration_seconds: sessionData.currentDuration,
        average_pace_min_km: sessionData.averagePace,
        calories_burned: sessionData.calories,
        goal_achieved: goalAchieved,
        subjective_feedback: subjectiveFeedback
      };
      
      console.log('📝 Update payload:', updateData);
      
      const { error } = await supabase
        .from('training_sessions')
        .update(updateData)
        .eq('id', sessionData.sessionId);

      if (error) {
        console.error('❌ Supabase error updating session:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', error.details);
        console.error('❌ Error hint:', error.hint);
        throw new Error(`Erro ao salvar treino: ${error.message}`);
      }
      
      console.log('✅ Session completed successfully in database with ID:', sessionData.sessionId);
      setSessionData(current => current ? { ...current, status: 'completed' } : null);
      
    } catch (error) {
      console.error('❌ Fatal error completing session:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error; // Re-throw to allow TrainingSession component to handle
    }
  }, [sessionData, stopLocationTracking, checkGoalAchievement]);

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
          // Ensure startTime is a Date object (it might come as string from recovery)
          const startTime = current.startTime instanceof Date ? current.startTime : new Date(current.startTime);
          const durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
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

  // Manual simulation toggle for troubleshooting
  const toggleSimulationMode = useCallback(async () => {
    if (isSimulationMode) {
      // Stop simulation and try real GPS
      if (watchIdRef.current) {
        clearInterval(watchIdRef.current as any);
        watchIdRef.current = null;
      }
      setIsSimulationMode(false);
      setIsWatchingLocation(false);
      
      try {
        await startLocationTracking();
      } catch (error) {
        console.error('Failed to start real GPS:', error);
        setLocationError(error instanceof Error ? error.message : 'Erro ao iniciar GPS real');
      }
    } else {
      // Stop real GPS and start simulation
      stopLocationTracking();
      await startSimulationMode();
    }
  }, [isSimulationMode, startLocationTracking, stopLocationTracking, startSimulationMode]);

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
    isSimulationMode,
    locationError,
    gpsPermissionStatus,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    recoverSession,
    discardRecoveredSession,
    toggleSimulationMode,
    diagnoseProblem,
  };
};