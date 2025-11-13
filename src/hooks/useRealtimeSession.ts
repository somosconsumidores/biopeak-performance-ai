import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWakeLock } from './useWakeLock';
import { useSessionPersistence } from './useSessionPersistence';
import { useHibernationDetection } from './useHibernationDetection';
import { useBackgroundAudio } from './useBackgroundAudio';
import { useBackgroundNotifications } from './useBackgroundNotifications';
import { useBackgroundCoach } from './useBackgroundCoach';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';

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
  const [isNativeGPSActive, setIsNativeGPSActive] = useState(false);
  
  const watchIdRef = useRef<string | number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<LocationData | null>(null);
  const distanceAccumulatorRef = useRef(0);
  const microDistanceAccumulatorRef = useRef(0);
  const lastSnapshotDistanceRef = useRef(0);
  const last500mMarkRef = useRef(0); // Separate ref for 500m feedback tracking
  const lastLocationTimestampRef = useRef<number>(Date.now());
  const gpsCoordinatesRef = useRef<Array<[number, number]>>([]);
  const isInBackgroundRef = useRef(false);
  const nativeGPSListenerRef = useRef<any>(null);
  const baseDistanceBeforeBackgroundRef = useRef(0);
  const backgroundCoachRef = useRef<any>(null); // Stable ref to avoid stale closures
  const speedFallbackCooldownRef = useRef<number>(0); // ✅ NOVO: Cooldown para speed-based fallback

  // Wake lock for keeping screen active
  const { isActive: isWakeLockActive } = useWakeLock({ 
    enabled: keepScreenOn && isRecording 
  });

  // Background audio for iOS (keeps TTS working during hibernation)
  const backgroundAudio = useBackgroundAudio({
    enabled: isRecording && Capacitor.getPlatform() === 'ios'
  });

  // Background notifications (fallback for when audio fails)
  const backgroundNotifications = useBackgroundNotifications({
    enabled: isRecording
  });

  // Background coach with TTS for real-time feedback
  const backgroundCoach = useBackgroundCoach({
    enabled: true,
    enableTTS: true,
    feedbackInterval: 500, // Feedback a cada 500m
    backgroundAudio,
    notificationFallback: backgroundNotifications.scheduleNotification,
    isNativeGPSActive // Pass flag to disable WebView coach when Native GPS is active
  });

  // Keep backgroundCoachRef in sync with latest backgroundCoach instance
  useEffect(() => {
    backgroundCoachRef.current = backgroundCoach;
    console.log('🔄 [COACH REF] Updated backgroundCoachRef:', {
      isActive: backgroundCoach.isActive,
      isEnabled: backgroundCoach.isEnabled,
      feedbackCount: backgroundCoach.feedbackCount
    });
  }, [backgroundCoach]);

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
    // Se estiver rodando em app nativo (Xcode/Android Studio), NUNCA é emulador
    if (Capacitor.isNativePlatform()) {
      console.log('🍎 Dispositivo nativo detectado - GPS real será usado');
      return false;
    }
    
    const userAgent = navigator.userAgent.toLowerCase();
    const hostname = window.location.hostname;
    
    // Indicadores muito específicos de emulador (removidos 'dev', 'test', etc.)
    const emulatorIndicators = [
      'android emulator',
      'genymotion',
      'bluestacks',
    ];
    
    // Apenas localhost e 127.0.0.1 são ambientes de dev
    return emulatorIndicators.some(indicator => 
      userAgent.includes(indicator)
    ) || hostname === 'localhost' || hostname === '127.0.0.1';
  }, []);

  // Check GPS permission status
  const checkGPSPermission = useCallback(async (): Promise<'granted' | 'denied' | 'prompt'> => {
    try {
      const result = await Geolocation.checkPermissions();
      
      if (result.location === 'granted') {
        return 'granted';
      } else if (result.location === 'denied') {
        return 'denied';
      } else {
        return 'prompt';
      }
    } catch (error) {
      console.warn('Error checking GPS permission:', error);
      return 'prompt';
    }
  }, []);

  // Simulate GPS movement for development/testing
  const startSimulationMode = useCallback(async () => {
    console.log('🧪 Starting GPS simulation mode for development');
    setIsSimulationMode(true);
    setLocationError(null);
    
    // Try to get real location first, fallback to São Paulo if unavailable
    let currentLat = -23.5505; // Default: São Paulo, Brazil
    let currentLng = -46.6333;
    let usingRealLocation = false;
    
    try {
      // Attempt to get real GPS location with 5 second timeout
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('GPS timeout')), 5000);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timeout);
            resolve(pos);
          },
          (err) => {
            clearTimeout(timeout);
            reject(err);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      });
      
      currentLat = position.coords.latitude;
      currentLng = position.coords.longitude;
      usingRealLocation = true;
      console.log('🧪 Using real GPS location for simulation:', { latitude: currentLat, longitude: currentLng });
    } catch (error) {
      console.warn('⚠️ Could not get real GPS location, using default (São Paulo):', error);
      console.log('🧪 Using default location for simulation:', { latitude: currentLat, longitude: currentLng });
    }
    
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
    
    return true;
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
      
      // ❌ REMOVIDO: Auto-start de simulação
      // Apenas informar e deixar usuário decidir
      return Promise.reject(new Error('GPS não disponível. Verifique as permissões ou ative o modo simulação manualmente.'));
    }

    try {
      // Request permissions first
      const permissionResult = await Geolocation.requestPermissions();
      
      if (permissionResult.location !== 'granted') {
        throw new Error('Permissão de localização negada');
      }

      // Get initial position
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });

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
        speed: position.coords.speed || undefined,
      };
      
      // Start watching position
      const watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000,
        },
        (position, err) => {
          if (err) {
            console.error('GPS Error during tracking:', err);
            // For emulator environments, fall back to simulation on tracking error
            if (isEmulator) {
              console.log('🧪 GPS tracking failed in emulator, falling back to simulation');
              startSimulationMode();
            }
            return;
          }

          if (!position) return;

          // 🚫 EXCLUSION: Skip if Native GPS is active
          if (isNativeGPSActive) {
            console.log('⏸️ [WebView GPS] Skipping - Native GPS is active');
            return;
          }

          const newLocation: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            speed: position.coords.speed || undefined,
          };

          console.log('📍 [WebView GPS] Update:', newLocation);
          console.log('📍 [DISTANCE UPDATE] WebView received:', {
            currentDistance: distanceAccumulatorRef.current,
            timestamp: new Date().toISOString()
          });

          // Store GPS coordinates for later analysis
          gpsCoordinatesRef.current.push([newLocation.latitude, newLocation.longitude]);

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
            
            // ✅ CORREÇÃO: Backup speed-based com proteções anti-backfill
            const allowSpeedFallback = Date.now() > speedFallbackCooldownRef.current;
            
            if (allowSpeedFallback && distance <= threshold && newLocation.speed && newLocation.speed > 0.5) {
              const timeElapsed = (Date.now() - lastLocationTimestampRef.current) / 1000;
              
              // ✅ PROTEÇÃO: Limitar timeElapsed a max 5s para evitar backfills absurdos
              const safeTimeElapsed = Math.min(timeElapsed, 5);
              
              if (safeTimeElapsed > 0) {
                const speedDistance = newLocation.speed * safeTimeElapsed;
                
                // ✅ NOVO: Cap máximo de 20m por tick para evitar saltos
                if (speedDistance > 1 && speedDistance < 20) {
                  distanceAccumulatorRef.current += speedDistance;
                  console.log(`🚀 Speed-based distance: +${speedDistance.toFixed(1)}m from ${newLocation.speed.toFixed(1)}m/s over ${safeTimeElapsed.toFixed(1)}s`);
                } else {
                  console.log(`⚠️ Speed-based distance rejected: ${speedDistance.toFixed(1)}m (out of safe range 1-20m)`);
                }
              }
            } else if (!allowSpeedFallback) {
              console.log(`⏸️ Speed-based fallback in cooldown (${((speedFallbackCooldownRef.current - Date.now()) / 1000).toFixed(1)}s remaining)`);
            }
          }

          lastLocationRef.current = newLocation;
          lastLocationTimestampRef.current = Date.now();
        }
      );

      watchIdRef.current = watchId;
      setIsWatchingLocation(true);
      return true;

    } catch (error: any) {
      console.error('🚨 GPS Error:', error);
      
      const diagnosis = await diagnoseProblem();
      setLocationError(diagnosis);
      setGpsPermissionStatus('denied');
      
      const errorMessage = error.message || 'Erro ao iniciar GPS';
      
      // Auto-fallback to simulation in emulator environments
      if (isEmulator) {
        console.log('🧪 Auto-fallback to simulation mode for emulator');
        try {
          await startSimulationMode();
          return true;
        } catch (simError) {
          console.error('Simulation mode failed:', simError);
        }
      }
      
      console.error('GPS Error details:', errorMessage);
      throw new Error(errorMessage);
    }
  }, [calculateDistance, isEmulatorOrDev, checkGPSPermission, diagnoseProblem, startSimulationMode]);

  // Stop GPS tracking
  const stopLocationTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      try {
        await Geolocation.clearWatch({ id: String(watchIdRef.current) });
      } catch (error) {
        console.error('Error clearing GPS watch:', error);
      }
      watchIdRef.current = null;
    }
    setIsWatchingLocation(false);
  }, []);

  // Switch to native GPS when app goes to background (iOS + Android)
  const switchToNativeGPS = useCallback(async () => {
    const platform = Capacitor.getPlatform();
    if (!Capacitor.isNativePlatform() || (platform !== 'ios' && platform !== 'android')) return;
    
    console.log(`🔄 [GPS HYBRID ${platform}] Switching to native GPS (app backgrounded)...`);
    
    try {
      // Stop WebView GPS
      stopLocationTracking();
      
      // 🚫 Activate Native GPS mode - disables ALL WebView GPS/Coach/Snapshots
      // Native GPS continues running continuously - we just switch which system we're using
      setIsNativeGPSActive(true);
      console.log(`✅ [EXCLUSION ${platform}] Native GPS mode ACTIVATED - WebView GPS disabled`);
      console.log(`📍 [Native GPS ${platform}] Already running continuously - no reset needed`);
    } catch (error) {
      console.error(`❌ [GPS HYBRID ${platform}] Failed to switch to native GPS:`, error);
      setIsNativeGPSActive(false); // Rollback on error
    }
  }, [stopLocationTracking]);

  // Sync native GPS back to WebView when app returns to foreground
  const syncNativeGPSToWebView = useCallback(async () => {
    const platform = Capacitor.getPlatform();
    if (!Capacitor.isNativePlatform() || (platform !== 'ios' && platform !== 'android')) return;
    
    console.log(`🔄 [GPS HYBRID ${platform}] Syncing native GPS → WebView...`);
    
    try {
      // Get accumulated distance from native GPS
      const { BioPeakLocationTracker } = await import('@/plugins/BioPeakLocationTracker');
      const { distance: nativeDistance } = await BioPeakLocationTracker.getAccumulatedDistance();
      
      // ✅ CORREÇÃO CRÍTICA 1: Atualizar distância
      distanceAccumulatorRef.current = nativeDistance;
      
      // ✅ CORREÇÃO CRÍTICA 2: Resetar timestamp para NOW (previne backfill fatal)
      lastLocationTimestampRef.current = Date.now();
      
      // ✅ CORREÇÃO CRÍTICA 3: Zerar micro-acumulador
      microDistanceAccumulatorRef.current = 0;
      
      // ✅ CORREÇÃO CRÍTICA 4: Sincronizar marca de feedback (previne duplicação)
      const currentSegment = Math.floor(nativeDistance / 500);
      last500mMarkRef.current = currentSegment;
      console.log(`🔄 [GPS SYNC ${platform}] Synced feedback mark to ${currentSegment} (${currentSegment * 500}m)`);
      
      // ✅ CORREÇÃO CRÍTICA 5: Ativar cooldown de 10s no speed-based fallback
      speedFallbackCooldownRef.current = Date.now() + 10000; // 10 segundos
      
      console.log(`✅ [GPS HYBRID ${platform}] Distance synced: ${nativeDistance.toFixed(1)}m`);
      console.log(`✅ [GPS HYBRID ${platform}] Timestamp reset to prevent backfill`);
      console.log(`✅ [GPS HYBRID ${platform}] Speed-based fallback cooldown activated (10s)`);
      console.log(`📍 [Native GPS ${platform}] Continues running in background`);
      
      // ✅ Deactivate Native GPS mode - re-enables WebView GPS/Coach/Snapshots
      // Native GPS continues running - we just switch which system we're using
      setIsNativeGPSActive(false);
      console.log(`✅ [EXCLUSION ${platform}] Native GPS mode DEACTIVATED - WebView GPS re-enabled`);
      
      // Restart WebView GPS
      if (isRecording) {
        await startLocationTracking();
        console.log(`✅ [GPS HYBRID ${platform}] WebView GPS restarted`);
      }
    } catch (error) {
      console.error(`❌ [GPS HYBRID ${platform}] Failed to sync native GPS:`, error);
      setIsNativeGPSActive(false); // Ensure flag is reset on error
    }
  }, [isRecording, startLocationTracking]);

  // Create performance snapshot and check for AI coaching triggers
  const createSnapshot = useCallback(async (sessionData: SessionData, location: LocationData) => {
    if (!sessionData.sessionId) return;

    // 🚫 EXCLUSION: Skip if Native GPS is active
    if (isNativeGPSActive) {
      console.log('⏸️ [WebView Snapshot] Skipping - Native GPS is active');
      return;
    }

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
      source: 'webview',
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

      // AI coaching triggers: feedback every 500m
      const distanceIn500m = Math.floor(sessionData.currentDistance / 500);
      const lastMark = last500mMarkRef.current; // Use separate ref for 500m feedback

      // Trigger feedback when a new 500m segment is completed
      const distanceTrigger = distanceIn500m > lastMark && distanceIn500m > 0;

      if (distanceTrigger && !isNativeGPSActive) {
        console.log('✅ [SNAPSHOT TRIGGER] Firing 500m feedback:', { 
          currentDistance: sessionData.currentDistance,
          distanceIn500m, 
          lastMark
        });
        
        // Update ONLY the 500m feedback ref (not the snapshot ref)
        last500mMarkRef.current = distanceIn500m;
        
        // Convert sessionData to the format expected by backgroundCoach
        const coachData = {
          distance: sessionData.currentDistance,
          duration: sessionData.currentDuration,
          pace: sessionData.currentPace,
          calories: sessionData.calories,
          sessionId: sessionData.sessionId,
          goal: sessionData.goal,
          currentDistance: sessionData.currentDistance,
          currentDuration: sessionData.currentDuration,
          currentPace: sessionData.currentPace
        };
        
        // DEBUG: Log coach state before calling feedback
        console.log('🎤 [COACH CALL] Attempting to generate feedback:', {
          coachExists: !!backgroundCoachRef.current,
          coachActive: backgroundCoachRef.current?.isActive,
          coachEnabled: backgroundCoachRef.current?.isEnabled,
          feedbackCount: backgroundCoachRef.current?.feedbackCount,
          distanceIn500m
        });
        
        // Use ref to avoid stale closure
        if (backgroundCoachRef.current) {
          await backgroundCoachRef.current.generateSnapshotFeedback(coachData);
          console.log('✅ [COACH CALL] Feedback generation completed');
        } else {
          console.error('❌ [COACH CALL] backgroundCoachRef is null!');
        }
      } else if (distanceTrigger && isNativeGPSActive) {
        console.log('⏸️ [SNAPSHOT TRIGGER SKIP] Native GPS is active - letting native handle feedback');
      } else {
        console.log('⏸️ [SNAPSHOT SKIP] Conditions not met:', {
          currentDistance: sessionData.currentDistance,
          distanceIn500m,
          lastMark
        });
      }
    } catch (error) {
      console.error('Error creating snapshot:', error);
    }
  }, [isNativeGPSActive, supabase]); // Added isNativeGPSActive dependency

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
        
        // Check if app is in background
        const isInBackground = document.visibilityState === 'hidden';
        
        // If in background, send notification as primary method
        if (isInBackground && backgroundNotifications.isSupported && backgroundNotifications.hasPermission) {
          console.log('📱 App in background, sending notification');
          await backgroundNotifications.scheduleNotification({
            title: '🏃 BioPeak Coach',
            body: data.feedback,
            sound: true,
          });
        }
        
        // Enhanced TTS with better voice quality (works in background on iOS with background audio)
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
            // Play enhanced TTS audio (works with background audio on iOS)
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
          // If TTS fails and we're in background, make sure notification was sent
          if (isInBackground && backgroundNotifications.isSupported && backgroundNotifications.hasPermission) {
            await backgroundNotifications.scheduleNotification({
              title: '🏃 BioPeak Coach',
              body: data.feedback,
              sound: true,
            });
          }
        }
      } else {
        console.warn('⚠️ No feedback received from AI Coach');
      }
    } catch (error) {
      console.error('❌ Error requesting AI feedback:', error);
    }
  }, [backgroundNotifications]);

  // Start training session
  const startSession = useCallback(async (goal: TrainingGoal, workoutId?: string) => {
    if (!user) return null;

    try {
      console.log('🚀 [AI COACH DEBUG] Starting new training session...');
      console.log('🎯 [AI COACH DEBUG] Goal:', goal);
      console.log('📋 [AI COACH DEBUG] Workout ID:', workoutId);
      
      // Reset distance accumulator for new session
      distanceAccumulatorRef.current = 0;
      lastSnapshotDistanceRef.current = 0;
      last500mMarkRef.current = 0; // Reset 500m feedback tracking
      lastLocationRef.current = null;
      gpsCoordinatesRef.current = [];
      
      // Create session in database
      const { data: session, error } = await supabase
        .from('training_sessions')
        .insert({
          user_id: user.id,
          session_type: goal.type,
          goal_data: goal as any,
          workout_id: workoutId || null,
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
      
      // Start Android Foreground Service for background tracking
      if (Capacitor.getPlatform() === 'android') {
        try {
          await ForegroundService.startForegroundService({
            body: 'Rastreando seu treino em tempo real',
            buttons: [
              {
                id: 1,
                title: 'Ver treino'
              }
            ],
            id: 1,
            smallIcon: 'ic_notification',
            title: '🏃 BioPeak - Treino Ativo'
          });
          console.log('✅ Android Foreground Service started');
        } catch (error) {
          console.warn('⚠️ Failed to start Android Foreground Service:', error);
        }
      }
      
      // Start GPS tracking - this will throw an error if it fails
      await startLocationTracking();
      console.log('✅ GPS tracking started successfully');

      // 🍎🤖 [iOS/Android] Start Native GPS ONCE at session start (runs continuously)
      const isNativePlatform = Capacitor.isNativePlatform() && 
        (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android');
      if (isNativePlatform && goal) {
        try {
          console.log('🚀 [Native GPS] Starting continuous tracking for entire session');
          
          const { BioPeakLocationTracker } = await import('@/plugins/BioPeakLocationTracker');
          
          // Get user JWT token for authenticated native GPS snapshots
          const { data: { session: authSession } } = await supabase.auth.getSession();
          const userToken = authSession?.access_token;

          if (!userToken) {
            console.error('❌ No user token available for Native GPS');
            throw new Error('User not authenticated');
          }

          // Configure feedback for native GPS with user token
          await BioPeakLocationTracker.configureFeedback({
            sessionId: session.id,
            trainingGoal: goal.type,
            enabled: true,
            supabaseUrl: 'https://grcwlmltlcltmwbhdpky.supabase.co',
            supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM',
            userToken: userToken
          });
          
          // Start tracking - Service will initialize with distance=0 at session start
          const result = await BioPeakLocationTracker.startLocationTracking();
          
          if (result.success) {
            console.log(`✅ [Native GPS ${Capacitor.getPlatform()}] Continuous tracking started - will run for entire session`);
            console.log(`📍 [Native GPS ${Capacitor.getPlatform()}] Will persist across background/foreground transitions`);
          } else {
            console.warn(`⚠️ [Native GPS ${Capacitor.getPlatform()}] Failed to start:`, result.message);
          }
        } catch (error) {
          console.error('❌ [Native GPS] Error starting continuous tracking:', error);
        }
      }

      // Start background coach with TTS
      if (goal) {
        console.log('🎯 Iniciando coach com objetivo:', goal.type);
        await backgroundCoach.startCoaching(goal);
      }

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

          // Send data to background coach for real-time analysis (map properties)
          backgroundCoach.analyzePerformance({
            distance: updated.currentDistance,
            duration: updated.currentDuration,
            pace: updated.currentPace,
            calories: updated.calories,
            goal: updated.goal,
            sessionId: updated.sessionId
          });

          // Check if goal was achieved and auto-complete session
          const goalAchieved = checkGoalAchievement(updated);
          if (goalAchieved && updated.goal.type !== 'free_run') {
            console.log('🎯 [AUTO-COMPLETE] Goal achieved! Auto-completing session...', {
              type: updated.goal.type,
              currentDistance: updated.currentDistance,
              targetDistance: updated.goal.targetDistance,
              currentDuration: updated.currentDuration,
              targetDuration: updated.goal.targetDuration
            });
            
            // Auto-complete session asynchronously
            setTimeout(() => {
              completeSession().catch(error => {
                console.error('❌ Error auto-completing session:', error);
              });
            }, 0);
          }

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

    // Pause background coach
    backgroundCoach.pauseCoaching();

    setIsRecording(false);
    
    // Stop Android Foreground Service when pausing
    if (Capacitor.getPlatform() === 'android') {
      try {
        await ForegroundService.stopForegroundService();
        console.log(`🛑 [Foreground Service ${Capacitor.getPlatform()}] Stopped (session paused)`);
      } catch (error) {
        console.warn(`⚠️ [Foreground Service ${Capacitor.getPlatform()}] Failed to stop:`, error);
      }
    }
    
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

    // Resume background coach
    backgroundCoach.resumeCoaching();

    setIsRecording(true);
    
    // Restart Android Foreground Service when resuming
    if (Capacitor.getPlatform() === 'android') {
      try {
        await ForegroundService.startForegroundService({
          body: 'Rastreando seu treino em tempo real',
          buttons: [
            {
              id: 1,
              title: 'Ver treino'
            }
          ],
          id: 1,
          smallIcon: 'ic_notification',
          title: '🏃 BioPeak - Treino Ativo'
        });
        console.log(`▶️ [Foreground Service ${Capacitor.getPlatform()}] Restarted (session resumed)`);
        console.log('✅ Android Foreground Service restarted (resumed)');
      } catch (error) {
        console.warn('⚠️ Failed to restart Android Foreground Service:', error);
      }
    }
    
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

          const updated = {
            ...current,
            currentDistance: distanceAccumulatorRef.current,
            currentDuration: durationSeconds,
            currentPace,
            averagePace: currentPace,
            calories,
            // DO NOT update lastSnapshot here - only in createSnapshot function
          };

          // Check if goal was achieved and auto-complete session
          const goalAchieved = checkGoalAchievement(updated);
          if (goalAchieved && updated.goal.type !== 'free_run') {
            console.log('🎯 [AUTO-COMPLETE] Goal achieved! Auto-completing session...', {
              type: updated.goal.type,
              currentDistance: updated.currentDistance,
              targetDistance: updated.goal.targetDistance,
              currentDuration: updated.currentDuration,
              targetDuration: updated.goal.targetDuration
            });
            
            // Auto-complete session asynchronously
            setTimeout(() => {
              completeSession().catch(error => {
                console.error('❌ Error auto-completing session:', error);
              });
            }, 0);
          }

          return updated;
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

  // ✅ NOVO: Listener em tempo real para eventos do Native GPS
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return;
    
    let listener: any;
    
    const setupListener = async () => {
      try {
        const { BioPeakLocationTracker } = await import('@/plugins/BioPeakLocationTracker');
        
        listener = await BioPeakLocationTracker.addListener('locationUpdate', (data) => {
          if (isNativeGPSActive) {
            console.log(`📍 [Native GPS Event] Distance: ${data.totalDistance.toFixed(1)}m, Delta: ${data.distance.toFixed(1)}m`);
            
            // ✅ Atualizar refs em tempo real
            distanceAccumulatorRef.current = data.totalDistance;
            lastLocationTimestampRef.current = Date.now(); // ✅ Manter timestamp atualizado
            
            // ✅ Atualizar lastLocationRef para ter coordenadas atuais
            lastLocationRef.current = {
              latitude: data.latitude,
              longitude: data.longitude,
              accuracy: data.accuracy,
              altitude: data.altitude,
              speed: data.speed,
            };
            
            gpsCoordinatesRef.current.push([data.latitude, data.longitude]);
          }
        });
        
        console.log('✅ [GPS HYBRID] Native GPS listener configured for real-time sync');
      } catch (error) {
        console.error('❌ [GPS HYBRID] Failed to setup native GPS listener:', error);
      }
    };
    
    setupListener();
    
    return () => {
      if (listener) {
        listener.remove();
        console.log('🧹 [GPS HYBRID] Native GPS listener removed');
      }
    };
  }, [isNativeGPSActive]);

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

  // Fallback function to generate completion audio via web
  const generateCompletionAudioFallback = async (session: any) => {
    try {
      console.log('🔄 [Fallback] Generating completion audio via JS...');
      
      const distanceKm = (session.currentDistance / 1000).toFixed(2);
      const durationMin = Math.floor(session.currentDuration / 60);
      const durationSec = session.currentDuration % 60;
      const pace = session.averagePace;
      const paceMin = Math.floor(pace);
      const paceSec = Math.floor((pace - paceMin) * 60);
      
      const motivationPhrases = [
        "Excelente desempenho hoje! Continue assim.",
        "Você está evoluindo rápido — orgulhe-se desse treino!",
        "Mais um passo na jornada. Mantenha a constância!",
        "Ótimo trabalho! A cada treino, mais forte.",
        "Treino concluído com sucesso! Descanse bem para o próximo desafio."
      ];
      const motivation = motivationPhrases[Math.floor(Math.random() * motivationPhrases.length)];
      
      const timeText = durationSec > 0 
        ? `${durationMin} minutos e ${durationSec} segundos`
        : `${durationMin} minutos`;
      
      const message = `Parabéns! Você completou seu treino em ${timeText}, percorrendo uma distância de ${distanceKm} quilômetros em um pace de ${paceMin} minutos e ${paceSec} segundos por quilômetro. ${motivation}`;
      
      // Call TTS edge function
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: message, voice: 'alloy', speed: 1.0 }
      });
      
      if (error) throw error;
      
      // Play audio via Web Audio API
      const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
      await audio.play();
      
      console.log('✅ [Fallback] Completion audio played successfully');
    } catch (error) {
      console.error('❌ [Fallback] Failed to play completion audio:', error);
    }
  };

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

    // Stop background coach
    await backgroundCoach.stopCoaching();

    // Stop background audio
    backgroundAudio.stopBackgroundAudio();
    
    // 🍎🤖 [iOS/Android] Handle Native GPS completion
    const isNativePlatform = Capacitor.isNativePlatform() && 
      (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android');
    if (isNativePlatform) {
      try {
        const { BioPeakLocationTracker } = await import('@/plugins/BioPeakLocationTracker');
        
        // 🎉 Generate and play completion audio FIRST (while audio session is still active)
        console.log('🎉 [Native GPS] Attempting to generate completion audio...');
        console.log('📊 [Native GPS] Session data:', {
          distance: sessionData.currentDistance,
          duration: sessionData.currentDuration,
          pace: sessionData.averagePace,
          calories: sessionData.calories
        });
        
        const completionResult = await BioPeakLocationTracker.generateCompletionAudio();
        console.log('🎯 [Native GPS] Completion audio result:', completionResult);
        
        if (!completionResult.success) {
          console.warn('⚠️ [Native GPS] Completion audio failed, using fallback:', completionResult.message);
          await generateCompletionAudioFallback(sessionData);
        } else {
          console.log('✅ [Native GPS] Completion audio played successfully');
        }
        
        // Then stop continuous Native GPS tracking
        console.log('🛑 [Native GPS] Stopping continuous tracking');
        const stopResult = await BioPeakLocationTracker.stopLocationTracking();
        console.log(`✅ [Native GPS] Stopped - Final distance: ${stopResult.finalDistance.toFixed(1)}m`);
        
        // Use native GPS final distance if it's greater (more accurate)
        if (stopResult.finalDistance > sessionData.currentDistance) {
          console.log(`📊 [Native GPS] Using native final distance: ${(stopResult.finalDistance / 1000).toFixed(2)}km (was ${(sessionData.currentDistance / 1000).toFixed(2)}km)`);
          sessionData.currentDistance = stopResult.finalDistance;
          distanceAccumulatorRef.current = stopResult.finalDistance;
        }
        
        // Clean up native GPS session data
        console.log('🧹 [Native GPS] Cleaning up session data');
        await BioPeakLocationTracker.cleanup();
        
        // Finally stop AVAudioSession
        const { BioPeakAudioSession } = await import('@/plugins/BioPeakAudioSession');
        await BioPeakAudioSession.stopAudioSession();
        console.log('✅ AVAudioSession stopped after training ended');
      } catch (error) {
        console.error('❌ Error stopping native GPS/audio:', error);
        // Fallback in case of any error
        try {
          await generateCompletionAudioFallback(sessionData);
        } catch (fallbackError) {
          console.error('❌ Fallback completion audio also failed:', fallbackError);
        }
      }
    }

    setIsRecording(false);
    stopLocationTracking();
    
    // Stop Android Foreground Service
    if (Capacitor.getPlatform() === 'android') {
      try {
        await ForegroundService.stopForegroundService();
        console.log('✅ Android Foreground Service stopped');
      } catch (error) {
        console.warn('⚠️ Failed to stop Android Foreground Service:', error);
      }
    }
    
    // Cancel all pending notifications
    if (backgroundNotifications.isSupported) {
      await backgroundNotifications.cancelAllNotifications();
    }
    
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
      
      const { data: sessionResult, error } = await supabase
        .from('training_sessions')
        .update(updateData)
        .eq('id', sessionData.sessionId)
        .select('workout_id')
        .single();

      if (error) {
        console.error('❌ Supabase error updating session:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', error.details);
        console.error('❌ Error hint:', error.hint);
        throw new Error(`Erro ao salvar treino: ${error.message}`);
      }
      
      console.log('✅ Session completed successfully in database with ID:', sessionData.sessionId);
      console.log('🔄 Database trigger will automatically process analytics for this BioPeak activity');
      
      // Update training_plan_workouts if this session is linked to a workout
      if (sessionResult?.workout_id) {
        console.log('📋 Updating training_plan_workouts for workout_id:', sessionResult.workout_id);
        
        const workoutUpdateData = {
          completed: true,
          actual_duration: sessionData.currentDuration,
          actual_distance: sessionData.currentDistance,
          completion_notes: goalAchieved 
            ? `✅ Objetivo alcançado! Distância: ${(sessionData.currentDistance / 1000).toFixed(2)}km, Duração: ${Math.floor(sessionData.currentDuration / 60)}min, Pace: ${sessionData.averagePace.toFixed(1)} min/km`
            : `Treino concluído. Distância: ${(sessionData.currentDistance / 1000).toFixed(2)}km, Duração: ${Math.floor(sessionData.currentDuration / 60)}min, Pace: ${sessionData.averagePace.toFixed(1)} min/km`
        };
        
        const { error: workoutError } = await supabase
          .from('training_plan_workouts')
          .update(workoutUpdateData)
          .eq('id', sessionResult.workout_id);
        
        if (workoutError) {
          console.error('⚠️ Error updating training_plan_workouts:', workoutError);
          // Don't throw here - session is already completed, workout update is secondary
        } else {
          console.log('✅ Training plan workout marked as completed');
        }
      }
      
      // ========== Save GPS coordinates to activity_coordinates ==========
      console.log('📍 Checking GPS coordinates for saving...');
      const collectedCoordinates = gpsCoordinatesRef.current;
      console.log(`📊 Total GPS coordinates collected: ${collectedCoordinates.length}`);

      if (collectedCoordinates.length > 0) {
        console.log('💾 Saving GPS coordinates to activity_coordinates table...');
        
        try {
          // Calculate bounding box
          const lats = collectedCoordinates.map(coord => coord[0]);
          const lons = collectedCoordinates.map(coord => coord[1]);
          const boundingBox = [
            [Math.min(...lats), Math.min(...lons)],
            [Math.max(...lats), Math.max(...lons)]
          ];
          
          const startingCoord = collectedCoordinates[0];
          
          // Check if activity_coordinates already exists (from Native GPS)
          const { data: existingCoords, error: checkError } = await supabase
            .from('activity_coordinates')
            .select('id, coordinates, total_points')
            .eq('activity_id', sessionData.sessionId)
            .eq('user_id', user!.id)
            .maybeSingle();
          
          if (checkError) {
            console.error('⚠️ Error checking existing coordinates:', checkError);
          }
          
          if (existingCoords) {
            // MERGE: Native GPS já salvou coordenadas, adicionar as do WebView
            console.log(`🔄 Merging ${collectedCoordinates.length} WebView coordinates with ${existingCoords.total_points} Native GPS coordinates`);
            
            const nativeCoords = existingCoords.coordinates as Array<[number, number]>;
            const mergedCoordinates = [...nativeCoords, ...collectedCoordinates];
            
            // Recalculate bounding box with merged data
            const allLats = mergedCoordinates.map(coord => coord[0]);
            const allLons = mergedCoordinates.map(coord => coord[1]);
            const mergedBoundingBox = [
              [Math.min(...allLats), Math.min(...allLons)],
              [Math.max(...allLats), Math.max(...allLons)]
            ];
            
            const { error: updateError } = await supabase
              .from('activity_coordinates')
              .update({
                coordinates: mergedCoordinates,
                total_points: mergedCoordinates.length,
                sampled_points: mergedCoordinates.length,
                bounding_box: mergedBoundingBox,
              })
              .eq('id', existingCoords.id);
            
            if (updateError) {
              console.error('❌ Error updating GPS coordinates:', updateError);
            } else {
              console.log(`✅ GPS coordinates merged successfully! Total: ${mergedCoordinates.length} points`);
            }
          } else {
            // INSERT: Não existem coordenadas Native GPS, salvar apenas as do WebView
            console.log(`📝 Inserting ${collectedCoordinates.length} WebView GPS coordinates`);
            
            const { error: insertError } = await supabase
              .from('activity_coordinates')
              .insert({
                user_id: user!.id,
                activity_id: sessionData.sessionId,
                activity_source: 'biopeak_app',
                coordinates: collectedCoordinates,
                total_points: collectedCoordinates.length,
                sampled_points: collectedCoordinates.length,
                starting_latitude: startingCoord[0],
                starting_longitude: startingCoord[1],
                bounding_box: boundingBox,
              });
            
            if (insertError) {
              console.error('❌ Error inserting GPS coordinates:', insertError);
            } else {
              console.log('✅ GPS coordinates saved successfully!');
            }
          }
          
          // Clear coordinates ref after saving
          gpsCoordinatesRef.current = [];
          console.log('🧹 GPS coordinates reference cleared');
          
        } catch (error) {
          console.error('❌ Fatal error saving GPS coordinates:', error);
          // Don't throw - coordinates are secondary, session is already completed
        }
      } else {
        console.log('⚠️ No GPS coordinates collected during this session');
      }
      // ========== End GPS coordinates save ==========
      
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
      }, 3000); // Save every 3 seconds for better recovery

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

          const updated = {
            ...current,
            currentDistance: distanceAccumulatorRef.current,
            currentDuration: durationSeconds,
            currentPace,
            averagePace: currentPace,
            calories,
            lastSnapshot: now
          };

          // Check if goal was achieved and auto-complete session
          const goalAchieved = checkGoalAchievement(updated);
          if (goalAchieved && updated.goal.type !== 'free_run') {
            console.log('🎯 [AUTO-COMPLETE] Goal achieved! Auto-completing session...', {
              type: updated.goal.type,
              currentDistance: updated.currentDistance,
              targetDistance: updated.goal.targetDistance,
              currentDuration: updated.currentDuration,
              targetDuration: updated.goal.targetDuration
            });
            
            // Auto-complete session asynchronously
            setTimeout(() => {
              completeSession().catch(error => {
                console.error('❌ Error auto-completing session:', error);
              });
            }, 0);
          }

          return updated;
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

  // Native Background GPS Hybrid System - Switch between WebView and Native GPS (iOS + Android)
  useEffect(() => {
    const platform = Capacitor.getPlatform();
    if (!Capacitor.isNativePlatform() || (platform !== 'ios' && platform !== 'android') || !isRecording) return;
    
    console.log(`📱 [HYBRID ${platform}] Background GPS hybrid system activated`);
    
    let graceTimeout: NodeJS.Timeout | null = null;
    let lastToggleTime = 0;
    const DEBOUNCE_MS = 10000; // 10s debounce
    const GRACE_PERIOD_MS = 7000; // 7s grace period
    
    const handleVisibilityChange = () => {
      const now = Date.now();
      if (now - lastToggleTime < DEBOUNCE_MS) {
        console.log(`⏸️ [HYBRID ${platform}] Debounce active, ignoring toggle`);
        return;
      }
      
      const wasInBackground = isInBackgroundRef.current;
      const isNowInBackground = document.visibilityState === 'hidden';
      isInBackgroundRef.current = isNowInBackground;
      
      if (isNowInBackground && !wasInBackground) {
        console.log(`📱 [HYBRID ${platform}] → Background: enabling native GPS`);
        lastToggleTime = now;
        switchToNativeGPS();
      } else if (!isNowInBackground && wasInBackground) {
        console.log(`📱 [HYBRID ${platform}] → Foreground: waiting grace window (7s)`);
        lastToggleTime = now;
        
        // Grace period: wait for WebView GPS to stabilize
        graceTimeout = setTimeout(() => {
          // Check if WebView has valid position
          const lastLoc = lastLocationRef.current;
          const isWebViewReady = lastLoc && 
                                 lastLoc.accuracy && 
                                 lastLoc.accuracy <= 25;
          
          if (isWebViewReady) {
            console.log(`✅ [HYBRID ${platform}] WebView ready (accuracy ≤25m) → syncing & disabling native`);
            syncNativeGPSToWebView();
          } else {
            console.log(`⏳ [HYBRID ${platform}] WebView not ready → keep native active`);
            // Native GPS stays active
          }
        }, GRACE_PERIOD_MS);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (graceTimeout) clearTimeout(graceTimeout);
    };
  }, [isRecording, switchToNativeGPS, syncNativeGPSToWebView]);

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