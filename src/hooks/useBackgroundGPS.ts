import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
}

interface BackgroundGPSOptions {
  enableHighAccuracy?: boolean;
  distanceFilter?: number;
  interval?: number;
  fastestInterval?: number;
  onLocationUpdate?: (location: LocationData) => void;
  onError?: (error: string) => void;
}

interface BackgroundGPSState {
  isActive: boolean;
  isSupported: boolean;
  lastLocation: LocationData | null;
  error: string | null;
  locationCount: number;
}

// Using standard Capacitor Geolocation for now
// Background functionality will be enhanced with native implementation

export const useBackgroundGPS = (options: BackgroundGPSOptions = {}) => {
  const [state, setState] = useState<BackgroundGPSState>({
    isActive: false,
    isSupported: false,
    lastLocation: null,
    error: null,
    locationCount: 0,
  });

  const watchIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);

  // Update options ref when they change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Check if background GPS is supported
  useEffect(() => {
    const checkSupport = async () => {
      try {
        const isSupported = Capacitor.isNativePlatform();
        setState(prev => ({ ...prev, isSupported }));
        
        if (isSupported) {
          // Check permissions
          const permissions = await Geolocation.checkPermissions();
          console.log('GPS permissions:', permissions);
        }
      } catch (error) {
        console.error('Error checking background GPS support:', error);
        setState(prev => ({ 
          ...prev, 
          isSupported: false, 
          error: 'Falha ao verificar suporte para GPS em background' 
        }));
      }
    };

    checkSupport();
  }, []);

  const handleLocationUpdate = useCallback((position: any) => {
    const locationData: LocationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      speed: position.coords.speed,
      heading: position.coords.heading,
      timestamp: position.timestamp,
    };

    setState(prev => ({
      ...prev,
      lastLocation: locationData,
      locationCount: prev.locationCount + 1,
      error: null,
    }));

    // Call the callback if provided
    optionsRef.current.onLocationUpdate?.(locationData);
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('Background GPS error:', error);
    const errorMessage = typeof error === 'string' ? error : 'Erro no GPS em background';
    
    setState(prev => ({ ...prev, error: errorMessage }));
    optionsRef.current.onError?.(errorMessage);
  }, []);

  const startTracking = useCallback(async () => {
    if (!state.isSupported) {
      throw new Error('Background GPS não é suportado neste dispositivo');
    }

    if (state.isActive) {
      console.warn('Background GPS já está ativo');
      return;
    }

    try {
      // Request permissions first
      const permissions = await Geolocation.requestPermissions();
      
      if (permissions.location !== 'granted') {
        throw new Error('Permissão de localização negada');
      }

      // Start high-accuracy location tracking
      const watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: options.enableHighAccuracy ?? true,
          timeout: 10000,
          maximumAge: 1000,
        },
        (position, err) => {
          if (err) {
            handleError(err);
            return;
          }

          if (position) {
            handleLocationUpdate(position);
          }
        }
      );

      watchIdRef.current = watchId;
      setState(prev => ({ 
        ...prev, 
        isActive: true, 
        error: null,
        locationCount: 0 
      }));
      console.log('Background GPS iniciado com sucesso');

    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [state.isSupported, state.isActive, options, handleLocationUpdate, handleError]);

  const stopTracking = useCallback(async () => {
    if (!state.isActive || !watchIdRef.current) {
      console.warn('Background GPS não está ativo');
      return;
    }

    try {
      await Geolocation.clearWatch({ id: watchIdRef.current });
      watchIdRef.current = null;
      
      setState(prev => ({ 
        ...prev, 
        isActive: false,
        error: null 
      }));
      
      console.log('Background GPS parado com sucesso');
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [state.isActive, handleError]);

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    if (!state.isSupported) {
      throw new Error('Background GPS não é suportado');
    }

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        speed: position.coords.speed,
        heading: position.coords.heading,
        timestamp: position.timestamp,
      };

      setState(prev => ({ ...prev, lastLocation: locationData }));
      return locationData;
    } catch (error) {
      handleError(error);
      return null;
    }
  }, [state.isSupported, handleError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        Geolocation.clearWatch({ id: watchIdRef.current }).catch(console.error);
      }
    };
  }, []);

  return {
    ...state,
    startTracking,
    stopTracking,
    getCurrentLocation,
  };
};