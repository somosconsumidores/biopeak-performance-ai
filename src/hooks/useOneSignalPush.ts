import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { usePlatform } from './usePlatform';

interface BioPeakOneSignalPlugin {
  initialize(): Promise<{ success: boolean; message: string }>;
  login(options: { externalId: string }): Promise<{ success: boolean; message: string; externalId?: string }>;
  logout(): Promise<{ success: boolean; message: string }>;
  requestPermission(): Promise<{ success: boolean; granted: boolean; message: string }>;
  getPermissionStatus(): Promise<{ granted: boolean; initialized: boolean }>;
  getSubscriptionId(): Promise<{ subscriptionId: string | null; initialized: boolean }>;
  getExternalId(): Promise<{ externalId: string | null; initialized: boolean }>;
  getFullStatus(): Promise<{ 
    initialized: boolean; 
    currentExternalId: string | null;
    permission?: boolean;
    subscriptionId?: string | null;
    optedIn?: boolean;
    token?: string | null;
    hasToken?: boolean;
    error?: string;
  }>;
  addListener(eventName: 'permissionChange', callback: (data: { granted: boolean }) => void): Promise<{ remove: () => void }>;
  addListener(eventName: 'subscriptionChange', callback: (data: { subscriptionId: string; optedIn: boolean; token?: string; hasToken?: boolean }) => void): Promise<{ remove: () => void }>;
}

interface UseOneSignalPushResult {
  isSupported: boolean;
  isInitialized: boolean;
  hasPermission: boolean;
  isLoggedIn: boolean;
  subscriptionId: string | null;
  isOptedIn: boolean;
  pushToken: string | null;
  initialize: () => Promise<boolean>;
  login: (userId: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
  getFullStatus: () => Promise<any>;
}

function getOneSignalPlugin(): BioPeakOneSignalPlugin | null {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  
  try {
    return (Capacitor as any).Plugins?.BioPeakOneSignal || null;
  } catch {
    return null;
  }
}

export function useOneSignalPush(): UseOneSignalPushResult {
  const { isAndroid } = usePlatform();
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [isOptedIn, setIsOptedIn] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);

  const isSupported = isAndroid;
  
  // Get full status for debugging
  const getFullStatus = useCallback(async (): Promise<any> => {
    if (!isSupported) return null;
    
    const plugin = getOneSignalPlugin();
    if (!plugin) return null;
    
    try {
      const status = await plugin.getFullStatus();
      console.log('[OneSignal] Full status:', status);
      return status;
    } catch (error) {
      console.error('[OneSignal] getFullStatus error:', error);
      return null;
    }
  }, [isSupported]);

  // Initialize OneSignal
  const initialize = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.log('[OneSignal] Not supported on this platform');
      return false;
    }

    const plugin = getOneSignalPlugin();
    if (!plugin) {
      console.log('[OneSignal] Plugin not available');
      return false;
    }

    try {
      console.log('[OneSignal] Initializing...');
      const result = await plugin.initialize();
      
      if (result.success) {
        setIsInitialized(true);
        
        // Get initial permission status
        const permStatus = await plugin.getPermissionStatus();
        setHasPermission(permStatus.granted);
        
        // Get subscription ID
        const subResult = await plugin.getSubscriptionId();
        setSubscriptionId(subResult.subscriptionId);
        
        // Check if already logged in
        const extIdResult = await plugin.getExternalId();
        setIsLoggedIn(!!extIdResult.externalId);
        
        console.log('[OneSignal] Initialized successfully');
        return true;
      } else {
        console.log('[OneSignal] Initialization failed:', result.message);
        return false;
      }
    } catch (error) {
      console.error('[OneSignal] Initialization error:', error);
      return false;
    }
  }, [isSupported]);

  // Login with user ID
  const login = useCallback(async (userId: string): Promise<boolean> => {
    if (!isSupported) return false;

    const plugin = getOneSignalPlugin();
    if (!plugin) return false;

    try {
      console.log('[OneSignal] Logging in with user ID:', userId.substring(0, 8) + '...');
      const result = await plugin.login({ externalId: userId });
      
      if (result.success) {
        setIsLoggedIn(true);
        console.log('[OneSignal] Login successful');
        return true;
      } else {
        console.log('[OneSignal] Login failed:', result.message);
        return false;
      }
    } catch (error) {
      console.error('[OneSignal] Login error:', error);
      return false;
    }
  }, [isSupported]);

  // Logout
  const logout = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    const plugin = getOneSignalPlugin();
    if (!plugin) return false;

    try {
      console.log('[OneSignal] Logging out...');
      const result = await plugin.logout();
      
      if (result.success) {
        setIsLoggedIn(false);
        console.log('[OneSignal] Logout successful');
        return true;
      } else {
        console.log('[OneSignal] Logout failed:', result.message);
        return false;
      }
    } catch (error) {
      console.error('[OneSignal] Logout error:', error);
      return false;
    }
  }, [isSupported]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    const plugin = getOneSignalPlugin();
    if (!plugin) return false;

    try {
      console.log('[OneSignal] Requesting permission...');
      const result = await plugin.requestPermission();
      
      setHasPermission(result.granted);
      console.log('[OneSignal] Permission result:', result.granted);
      return result.granted;
    } catch (error) {
      console.error('[OneSignal] Permission request error:', error);
      return false;
    }
  }, [isSupported]);

  // Set up event listeners
  useEffect(() => {
    if (!isSupported) return;

    const plugin = getOneSignalPlugin();
    if (!plugin) return;

    let permissionListener: { remove: () => void } | null = null;
    let subscriptionListener: { remove: () => void } | null = null;

    const setupListeners = async () => {
      try {
        permissionListener = await plugin.addListener('permissionChange', (data) => {
          console.log('[OneSignal] Permission changed:', data.granted);
          setHasPermission(data.granted);
        });

        subscriptionListener = await plugin.addListener('subscriptionChange', (data) => {
          console.log('[OneSignal] Subscription changed:', data);
          setSubscriptionId(data.subscriptionId);
          setIsOptedIn(data.optedIn);
          if (data.token) {
            setPushToken(data.token);
          }
        });
      } catch (error) {
        console.error('[OneSignal] Failed to setup listeners:', error);
      }
    };

    setupListeners();

    return () => {
      permissionListener?.remove();
      subscriptionListener?.remove();
    };
  }, [isSupported]);

  return {
    isSupported,
    isInitialized,
    hasPermission,
    isLoggedIn,
    subscriptionId,
    isOptedIn,
    pushToken,
    initialize,
    login,
    logout,
    requestPermission,
    getFullStatus,
  };
}
