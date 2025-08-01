import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
}

interface GPSState {
  status: 'granted' | 'denied' | 'prompt' | null;
  isTracking: boolean;
  isSimulationMode: boolean;
  isEmulator: boolean;
  hasGeolocation: boolean;
  isHttps: boolean;
  lastLocation: LocationData | null;
  lastUpdate: number | null;
  error: string | null;
}

interface UseEnhancedGPSResult extends GPSState {
  requestPermission: () => Promise<boolean>;
  startTracking: () => Promise<boolean>;
  stopTracking: () => void;
  toggleSimulation: () => void;
  diagnose: () => Promise<string>;
  retryConnection: () => Promise<boolean>;
  getLastKnownLocation: () => LocationData | null;
}

export const useEnhancedGPS = (): UseEnhancedGPSResult => {
  const { toast } = useToast();
  const [state, setState] = useState<GPSState>({
    status: null,
    isTracking: false,
    isSimulationMode: false,
    isEmulator: false,
    hasGeolocation: !!navigator.geolocation,
    isHttps: window.location.protocol === 'https:',
    lastLocation: null,
    lastUpdate: null,
    error: null
  });

  const watchIdRef = useRef<number | null>(null);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const locationHistoryRef = useRef<LocationData[]>([]);

  // Detect if running in emulator or development environment
  const detectEmulator = useCallback((): boolean => {
    const userAgent = navigator.userAgent.toLowerCase();
    const hostname = window.location.hostname;
    
    const emulatorIndicators = [
      'android emulator',
      'genymotion', 
      'bluestacks',
      'localhost',
      '127.0.0.1',
      '.local'
    ];
    
    return emulatorIndicators.some(indicator => 
      userAgent.includes(indicator) || hostname.includes(indicator)
    ) || hostname === 'localhost' || hostname.startsWith('192.168.');
  }, []);

  // Check current permission status
  const checkPermissionStatus = useCallback(async (): Promise<'granted' | 'denied' | 'prompt'> => {
    if (!navigator.permissions) {
      return 'prompt';
    }
    
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return permission.state;
    } catch (error) {
      console.warn('Error checking GPS permission:', error);
      return 'prompt';
    }
  }, []);

  // Request GPS permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.hasGeolocation) {
      const error = 'Geolocalização não suportada neste navegador';
      setState(prev => ({ ...prev, error }));
      toast({ title: "GPS Não Suportado", description: error, variant: "destructive" });
      return false;
    }

    if (!state.isHttps && !state.isEmulator) {
      const error = 'Geolocalização requer HTTPS em dispositivos reais';
      setState(prev => ({ ...prev, error }));
      toast({ title: "HTTPS Necessário", description: error, variant: "destructive" });
      return false;
    }

    try {
      setState(prev => ({ ...prev, error: null }));
      
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000
        });
      });

      const newStatus = await checkPermissionStatus();
      const location: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude || undefined,
        speed: position.coords.speed || undefined
      };

      setState(prev => ({
        ...prev,
        status: newStatus,
        lastLocation: location,
        lastUpdate: Date.now(),
        error: null
      }));

      // Store in history
      locationHistoryRef.current.push(location);
      if (locationHistoryRef.current.length > 10) {
        locationHistoryRef.current.shift();
      }

      toast({ title: "GPS Autorizado", description: "Localização permitida com sucesso" });
      return true;

    } catch (error: any) {
      const newStatus = await checkPermissionStatus();
      let errorMessage = 'Erro ao obter permissão de localização';

      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Permissão de localização negada pelo usuário';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Localização indisponível. Verifique se o GPS está ativo';
          break;
        case error.TIMEOUT:
          errorMessage = 'Tempo limite excedido ao obter localização';
          break;
      }

      setState(prev => ({ ...prev, status: newStatus, error: errorMessage }));
      toast({ title: "Erro GPS", description: errorMessage, variant: "destructive" });
      return false;
    }
  }, [state.hasGeolocation, state.isHttps, state.isEmulator, checkPermissionStatus, toast]);

  // Start GPS simulation mode
  const startSimulation = useCallback(() => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }

    let currentLat = -23.5505; // São Paulo
    let currentLng = -46.6333;
    let bearing = Math.random() * 360;

    const updateSimulation = () => {
      // Simulate realistic movement
      bearing += (Math.random() - 0.5) * 30; // ±15 degree variation
      const distance = 2 + Math.random() * 3; // 2-5 meters per second
      
      const latChange = (distance * Math.cos(bearing * Math.PI / 180)) / 111320;
      const lngChange = (distance * Math.sin(bearing * Math.PI / 180)) / (111320 * Math.cos(currentLat * Math.PI / 180));
      
      currentLat += latChange;
      currentLng += lngChange;

      const location: LocationData = {
        latitude: currentLat,
        longitude: currentLng,
        accuracy: 3 + Math.random() * 2,
        altitude: 750 + Math.random() * 10,
        speed: 2 + Math.random() * 2
      };

      setState(prev => ({
        ...prev,
        lastLocation: location,
        lastUpdate: Date.now(),
        isSimulationMode: true,
        isTracking: true,
        error: null
      }));

      // Store in history
      locationHistoryRef.current.push(location);
      if (locationHistoryRef.current.length > 10) {
        locationHistoryRef.current.shift();
      }
    };

    updateSimulation(); // Initial position
    simulationIntervalRef.current = setInterval(updateSimulation, 1000);
    
    toast({ title: "Modo Simulação", description: "GPS simulado ativado para testes" });
  }, [toast]);

  // Stop simulation mode
  const stopSimulation = useCallback(() => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setState(prev => ({ ...prev, isSimulationMode: false, isTracking: false }));
  }, []);

  // Start real GPS tracking
  const startTracking = useCallback(async (): Promise<boolean> => {
    if (state.status !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    try {
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      };

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const location: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            speed: position.coords.speed || undefined
          };

          setState(prev => ({
            ...prev,
            lastLocation: location,
            lastUpdate: Date.now(),
            isTracking: true,
            isSimulationMode: false,
            error: null
          }));

          // Store in history
          locationHistoryRef.current.push(location);
          if (locationHistoryRef.current.length > 10) {
            locationHistoryRef.current.shift();
          }
        },
        (error) => {
          let errorMessage = 'Erro durante rastreamento GPS';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permissão de GPS foi revogada';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'GPS temporariamente indisponível';
              break;
            case error.TIMEOUT:
              errorMessage = 'Timeout no GPS - tentando novamente...';
              break;
          }

          console.error('GPS tracking error:', error);
          setState(prev => ({ ...prev, error: errorMessage }));
          
          // Auto-retry on timeout
          if (error.code === error.TIMEOUT) {
            setTimeout(() => startTracking(), 2000);
          }
        },
        options
      );

      setState(prev => ({ ...prev, isTracking: true, error: null }));
      return true;

    } catch (error) {
      console.error('Failed to start GPS tracking:', error);
      setState(prev => ({ ...prev, error: 'Falha ao iniciar rastreamento GPS' }));
      return false;
    }
  }, [state.status, requestPermission]);

  // Stop GPS tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    stopSimulation();
    setState(prev => ({ ...prev, isTracking: false }));
  }, [stopSimulation]);

  // Toggle simulation mode
  const toggleSimulation = useCallback(() => {
    if (state.isSimulationMode) {
      stopSimulation();
    } else {
      stopTracking();
      startSimulation();
    }
  }, [state.isSimulationMode, stopSimulation, stopTracking, startSimulation]);

  // Enhanced diagnostics
  const diagnose = useCallback(async (): Promise<string> => {
    const isEmulator = detectEmulator();
    const permission = await checkPermissionStatus();
    const browser = navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                   navigator.userAgent.includes('Firefox') ? 'Firefox' :
                   navigator.userAgent.includes('Safari') ? 'Safari' : 'Unknown';

    let diagnosis = '🔍 DIAGNÓSTICO GPS AVANÇADO:\n\n';
    
    diagnosis += `📱 Ambiente: ${isEmulator ? 'Emulador/Dev' : 'Dispositivo Real'}\n`;
    diagnosis += `🌐 Navegador: ${browser}\n`;
    diagnosis += `🔒 Protocolo: ${state.isHttps ? 'HTTPS ✅' : 'HTTP ❌'}\n`;
    diagnosis += `📍 Geolocalização: ${state.hasGeolocation ? 'Disponível ✅' : 'Indisponível ❌'}\n`;
    diagnosis += `✅ Permissão: ${permission}\n\n`;

    if (!state.hasGeolocation) {
      diagnosis += '❌ PROBLEMA: Navegador não suporta geolocalização\n';
      diagnosis += '💡 SOLUÇÃO: Use Chrome, Firefox ou Safari atualizado\n\n';
    }

    if (!state.isHttps && !isEmulator) {
      diagnosis += '❌ PROBLEMA: HTTPS necessário para GPS em dispositivos reais\n';
      diagnosis += '💡 SOLUÇÃO: Acesse via HTTPS ou use modo simulação\n\n';
    }

    if (permission === 'denied') {
      diagnosis += '❌ PROBLEMA: Permissão GPS negada\n';
      diagnosis += '💡 SOLUÇÕES:\n';
      diagnosis += '  1. Clique no ícone 🔒 na barra de endereços\n';
      diagnosis += '  2. Altere localização para "Permitir"\n';
      diagnosis += '  3. Recarregue a página\n';
      diagnosis += '  4. Ou use o modo simulação para testes\n\n';
    }

    if (isEmulator) {
      diagnosis += '🧪 EMULADOR DETECTADO\n';
      diagnosis += '💡 CONFIGURAÇÃO:\n';
      diagnosis += '  1. Abra Extended Controls (⋯)\n';
      diagnosis += '  2. Vá em Location\n';
      diagnosis += '  3. Defina coordenadas ou use GPX\n';
      diagnosis += '  4. Ative GPS no Android Settings\n\n';
    }

    if (locationHistoryRef.current.length > 0) {
      const recent = locationHistoryRef.current.slice(-3);
      diagnosis += '📊 ÚLTIMAS LOCALIZAÇÕES:\n';
      recent.forEach((loc, i) => {
        diagnosis += `  ${i + 1}. ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)} (±${loc.accuracy?.toFixed(0)}m)\n`;
      });
    }

    return diagnosis;
  }, [detectEmulator, checkPermissionStatus, state.hasGeolocation, state.isHttps]);

  // Retry connection with intelligent fallback
  const retryConnection = useCallback(async (): Promise<boolean> => {
    const isEmulator = detectEmulator();
    
    // First try normal GPS
    const success = await requestPermission();
    if (success) {
      return startTracking();
    }
    
    // If failed and in emulator, auto-fallback to simulation
    if (isEmulator) {
      toast({ 
        title: "Fallback para Simulação", 
        description: "GPS real falhou, usando modo simulação" 
      });
      startSimulation();
      return true;
    }
    
    return false;
  }, [detectEmulator, requestPermission, startTracking, startSimulation, toast]);

  // Get last known location (with fallback to IP geolocation if needed)
  const getLastKnownLocation = useCallback((): LocationData | null => {
    if (locationHistoryRef.current.length > 0) {
      return locationHistoryRef.current[locationHistoryRef.current.length - 1];
    }
    return state.lastLocation;
  }, [state.lastLocation]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      const isEmulator = detectEmulator();
      const status = await checkPermissionStatus();
      
      setState(prev => ({
        ...prev,
        isEmulator,
        status
      }));
    };

    init();
  }, [detectEmulator, checkPermissionStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    ...state,
    requestPermission,
    startTracking,
    stopTracking,
    toggleSimulation,
    diagnose,
    retryConnection,
    getLastKnownLocation
  };
};