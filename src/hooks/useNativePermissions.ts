import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { Device } from '@capacitor/device';

export interface PermissionStatus {
  location: 'granted' | 'denied' | 'prompt' | 'unknown';
  camera: 'granted' | 'denied' | 'prompt' | 'unknown';
  microphone: 'granted' | 'denied' | 'prompt' | 'unknown';
}

export interface UseNativePermissionsResult {
  permissions: PermissionStatus;
  isNative: boolean;
  deviceInfo: any;
  requestAllPermissions: () => Promise<boolean>;
  requestLocationPermission: () => Promise<boolean>;
  requestCameraPermission: () => Promise<boolean>;
  checkPermissions: () => Promise<void>;
  isReady: boolean;
}

export const useNativePermissions = (): UseNativePermissionsResult => {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    location: 'unknown',
    camera: 'unknown',
    microphone: 'unknown'
  });
  
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  // Debug logging for native permissions
  console.log('🔍 NATIVE PERMISSIONS DEBUG:', {
    isNative,
    platform: Capacitor.getPlatform(),
    permissions,
    isReady
  });

  const getDeviceInfo = useCallback(async () => {
    try {
      if (isNative) {
        const info = await Device.getInfo();
        setDeviceInfo(info);
      } else {
        setDeviceInfo({
          platform: 'web',
          model: navigator.userAgent,
          operatingSystem: 'web'
        });
      }
    } catch (error) {
      console.error('Error getting device info:', error);
    }
  }, [isNative]);

  const checkPermissions = useCallback(async () => {
    try {
      const newPermissions: PermissionStatus = {
        location: 'unknown',
        camera: 'unknown',
        microphone: 'unknown'
      };

      if (isNative) {
        // Check native permissions using Capacitor plugins
        try {
          const locationStatus = await Geolocation.checkPermissions();
          newPermissions.location = locationStatus.location as any;
        } catch (error) {
          console.warn('Error checking location permissions:', error);
        }

        try {
          const cameraStatus = await Camera.checkPermissions();
          newPermissions.camera = cameraStatus.camera as any;
        } catch (error) {
          console.warn('Error checking camera permissions:', error);
        }
      } else {
        // Check web permissions
        if ('navigator' in window && 'permissions' in navigator) {
          try {
            const locationPerm = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
            newPermissions.location = locationPerm.state as any;
          } catch (error) {
            console.warn('Error checking web location permissions:', error);
          }

          try {
            const cameraPerm = await navigator.permissions.query({ name: 'camera' as PermissionName });
            newPermissions.camera = cameraPerm.state as any;
          } catch (error) {
            console.warn('Error checking web camera permissions:', error);
          }

          try {
            const micPerm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            newPermissions.microphone = micPerm.state as any;
          } catch (error) {
            console.warn('Error checking web microphone permissions:', error);
          }
        }
      }

      setPermissions(newPermissions);
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }, [isNative]);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    console.log('🚀 REQUESTING NATIVE LOCATION PERMISSION:', { isNative, platform: Capacitor.getPlatform() });
    
    try {
      if (isNative) {
        console.log('📱 USING NATIVE GEOLOCATION API...');
        const result = await Geolocation.requestPermissions();
        console.log('📱 NATIVE PERMISSION RESULT:', result);
        const granted = result.location === 'granted';
        setPermissions(prev => ({ ...prev, location: result.location as any }));
        return granted;
      } else {
        console.log('🌐 USING WEB GEOLOCATION API...');
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              setPermissions(prev => ({ ...prev, location: 'granted' }));
              resolve(true);
            },
            () => {
              setPermissions(prev => ({ ...prev, location: 'denied' }));
              resolve(false);
            }
          );
        });
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setPermissions(prev => ({ ...prev, location: 'denied' }));
      return false;
    }
  }, [isNative]);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (isNative) {
        const result = await Camera.requestPermissions();
        const granted = result.camera === 'granted';
        setPermissions(prev => ({ ...prev, camera: result.camera as any }));
        return granted;
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
          setPermissions(prev => ({ ...prev, camera: 'granted' }));
          return true;
        } catch (error) {
          setPermissions(prev => ({ ...prev, camera: 'denied' }));
          return false;
        }
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      setPermissions(prev => ({ ...prev, camera: 'denied' }));
      return false;
    }
  }, [isNative]);

  const requestAllPermissions = useCallback(async () => {
    console.log('🚀 REQUESTING ALL NATIVE PERMISSIONS...');
    
    // Force native permission request if on Android
    if (isNative && Capacitor.getPlatform() === 'android') {
      console.log('📱 FORCING ANDROID PERMISSION REQUEST...');
      try {
        const locationResult = await Geolocation.requestPermissions();
        console.log('📱 ANDROID LOCATION PERMISSION:', locationResult);
        
        // Test actual GPS access
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        console.log('📱 ANDROID GPS TEST SUCCESS:', position);
        
        setPermissions(prev => ({ ...prev, location: 'granted' }));
        return true;
      } catch (error) {
        console.error('❌ ANDROID GPS TEST FAILED:', error);
        setPermissions(prev => ({ ...prev, location: 'denied' }));
        return false;
      }
    }
    
    // Request location permission
    const locationGranted = await requestLocationPermission();
    
    // Request camera permission  
    const cameraGranted = await requestCameraPermission();
    
    // Re-check all permissions after requests
    await checkPermissions();
    
    console.log('✅ ALL PERMISSIONS REQUESTED:', { locationGranted, cameraGranted });
    return locationGranted;
  }, [requestLocationPermission, requestCameraPermission, checkPermissions, isNative]);

  useEffect(() => {
    const initializePermissions = async () => {
      await getDeviceInfo();
      await checkPermissions();
      setIsReady(true);
    };

    initializePermissions();
  }, [getDeviceInfo, checkPermissions]);

  return {
    permissions,
    isNative,
    deviceInfo,
    requestAllPermissions,
    requestLocationPermission,
    requestCameraPermission,
    checkPermissions,
    isReady
  };
};