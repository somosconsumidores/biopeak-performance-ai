import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { Device } from '@capacitor/device';

interface PushNotificationState {
  isInitialized: boolean;
  isSubscribed: boolean;
  playerId: string | null;
  error: string | null;
  isSupported: boolean;
}

interface OneSignalUser {
  getOnesignalId: () => Promise<string | null>;
  addTags: (tags: Record<string, string>) => void;
}

interface OneSignalNotifications {
  requestPermission: (fallbackToSettings: boolean) => Promise<boolean>;
  addEventListener: (event: string, callback: (event: any) => void) => void;
  removeEventListener: (event: string, callback: (event: any) => void) => void;
}

interface OneSignalType {
  initialize: (appId: string) => void;
  login: (externalId: string) => void;
  logout: () => void;
  User: OneSignalUser;
  Notifications: OneSignalNotifications;
}

// OneSignal is loaded globally via the Cordova plugin
declare global {
  interface Window {
    OneSignalPlugin?: OneSignalType;
  }
}

export const usePushNotifications = () => {
  const [state, setState] = useState<PushNotificationState>({
    isInitialized: false,
    isSubscribed: false,
    playerId: null,
    error: null,
    isSupported: false,
  });

  const isNative = Capacitor.isNativePlatform();

  const getOneSignal = useCallback((): OneSignalType | null => {
    if (typeof window !== 'undefined' && window.OneSignalPlugin) {
      return window.OneSignalPlugin;
    }
    // Try accessing via Capacitor plugins
    const capacitorPlugins = (Capacitor as any).Plugins;
    if (capacitorPlugins?.OneSignal) {
      return capacitorPlugins.OneSignal;
    }
    return null;
  }, []);

  const savePlayerIdToSupabase = useCallback(async (playerId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[PushNotifications] No user logged in, skipping token save');
        return;
      }

      const deviceInfo = await Device.getInfo();
      const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';

      const { error } = await supabase.from('push_notification_tokens').upsert({
        user_id: user.id,
        player_id: playerId,
        platform: platform,
        device_model: deviceInfo.model || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { 
        onConflict: 'user_id,platform',
        ignoreDuplicates: false 
      });

      if (error) {
        console.error('[PushNotifications] Error saving token:', error);
      } else {
        console.log('[PushNotifications] Token saved successfully for user:', user.id);
      }
    } catch (error) {
      console.error('[PushNotifications] Error in savePlayerIdToSupabase:', error);
    }
  }, []);

  const handleNotificationClick = useCallback((event: any) => {
    console.log('[PushNotifications] Notification clicked:', event);
    // Handle navigation based on notification data
    const data = event?.notification?.additionalData || event?.additionalData || {};
    
    if (data.route) {
      // Navigate to specific route
      window.location.href = data.route;
    }
  }, []);

  const handleForegroundNotification = useCallback((event: any) => {
    console.log('[PushNotifications] Foreground notification received:', event);
    // Display notification even when app is in foreground
    if (event?.notification?.display) {
      event.notification.display();
    }
  }, []);

  const initializeOneSignal = useCallback(async () => {
    if (!isNative) {
      console.log('[PushNotifications] Not a native platform, skipping initialization');
      return;
    }

    const OneSignal = getOneSignal();
    if (!OneSignal) {
      console.warn('[PushNotifications] OneSignal not available');
      setState(prev => ({ ...prev, error: 'OneSignal not available' }));
      return;
    }

    try {
      // Get OneSignal App ID from environment or use the one configured in native
      // The App ID should be configured in the native project
      const appId = import.meta.env.VITE_ONESIGNAL_APP_ID || '';
      
      if (appId) {
        OneSignal.initialize(appId);
        console.log('[PushNotifications] OneSignal initialized with app ID');
      }

      // Set up event listeners
      OneSignal.Notifications.addEventListener('click', handleNotificationClick);
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', handleForegroundNotification);

      // Get Player ID
      const playerId = await OneSignal.User.getOnesignalId();
      
      if (playerId) {
        await savePlayerIdToSupabase(playerId);
        setState(prev => ({
          ...prev,
          isInitialized: true,
          playerId,
          isSubscribed: true,
          isSupported: true,
        }));
        console.log('[PushNotifications] Player ID obtained:', playerId);
      } else {
        setState(prev => ({
          ...prev,
          isInitialized: true,
          isSupported: true,
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize OneSignal';
      console.error('[PushNotifications] Initialization error:', error);
      setState(prev => ({ ...prev, error: errorMessage }));
    }
  }, [isNative, getOneSignal, handleNotificationClick, handleForegroundNotification, savePlayerIdToSupabase]);

  useEffect(() => {
    if (isNative) {
      // Wait for device ready
      const timer = setTimeout(() => {
        initializeOneSignal();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isNative, initializeOneSignal]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const OneSignal = getOneSignal();
    if (!OneSignal) {
      console.warn('[PushNotifications] OneSignal not available for permission request');
      return false;
    }

    try {
      const granted = await OneSignal.Notifications.requestPermission(true);
      
      if (granted) {
        // Re-fetch player ID after permission granted
        const playerId = await OneSignal.User.getOnesignalId();
        if (playerId) {
          await savePlayerIdToSupabase(playerId);
          setState(prev => ({
            ...prev,
            isSubscribed: true,
            playerId,
          }));
        }
      }

      setState(prev => ({ ...prev, isSubscribed: granted }));
      return granted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request permission';
      console.error('[PushNotifications] Permission request error:', error);
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [getOneSignal, savePlayerIdToSupabase]);

  const setExternalUserId = useCallback(async (userId: string) => {
    const OneSignal = getOneSignal();
    if (!OneSignal) {
      console.warn('[PushNotifications] OneSignal not available for external user ID');
      return;
    }

    try {
      OneSignal.login(userId);
      console.log('[PushNotifications] External user ID set:', userId);

      // Update player ID after login
      const playerId = await OneSignal.User.getOnesignalId();
      if (playerId) {
        await savePlayerIdToSupabase(playerId);
        setState(prev => ({ ...prev, playerId }));
      }
    } catch (error) {
      console.error('[PushNotifications] Error setting external user ID:', error);
    }
  }, [getOneSignal, savePlayerIdToSupabase]);

  const clearExternalUserId = useCallback(async () => {
    const OneSignal = getOneSignal();
    if (!OneSignal) return;

    try {
      OneSignal.logout();
      console.log('[PushNotifications] External user ID cleared');
    } catch (error) {
      console.error('[PushNotifications] Error clearing external user ID:', error);
    }
  }, [getOneSignal]);

  const setUserTags = useCallback(async (tags: Record<string, string>) => {
    const OneSignal = getOneSignal();
    if (!OneSignal) {
      console.warn('[PushNotifications] OneSignal not available for tags');
      return;
    }

    try {
      OneSignal.User.addTags(tags);
      console.log('[PushNotifications] User tags set:', tags);
    } catch (error) {
      console.error('[PushNotifications] Error setting user tags:', error);
    }
  }, [getOneSignal]);

  const deactivateToken = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const platform = Capacitor.getPlatform();

      await supabase
        .from('push_notification_tokens')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('platform', platform);

      console.log('[PushNotifications] Token deactivated');
    } catch (error) {
      console.error('[PushNotifications] Error deactivating token:', error);
    }
  }, []);

  return {
    ...state,
    requestPermission,
    setExternalUserId,
    clearExternalUserId,
    setUserTags,
    deactivateToken,
    initializeOneSignal,
  };
};
