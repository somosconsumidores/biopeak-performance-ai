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

// Interface for our custom BioPeakOneSignal plugin
interface BioPeakOneSignalPlugin {
  initialize: () => Promise<{ success: boolean }>;
  login: (options: { userId: string }) => Promise<{ success: boolean }>;
  logout: () => Promise<{ success: boolean }>;
  getPlayerId: () => Promise<{ playerId: string | null; token: string | null; optedIn: boolean }>;
  requestPermission: () => Promise<{ granted: boolean }>;
  addTags: (options: { tags: Record<string, string> }) => Promise<{ success: boolean }>;
  getPermissionStatus: () => Promise<{ granted: boolean }>;
  addListener: (event: string, callback: (data: any) => void) => Promise<{ remove: () => void }>;
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

  const getOneSignalPlugin = useCallback((): BioPeakOneSignalPlugin | null => {
    if (!isNative) return null;
    
    try {
      const plugins = (Capacitor as any).Plugins;
      if (plugins?.BioPeakOneSignal) {
        return plugins.BioPeakOneSignal as BioPeakOneSignalPlugin;
      }
    } catch (e) {
      console.error('[PushNotifications] Error accessing BioPeakOneSignal plugin:', e);
    }
    return null;
  }, [isNative]);

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

  const initializeOneSignal = useCallback(async () => {
    if (!isNative) {
      console.log('[PushNotifications] Not a native platform, skipping initialization');
      return;
    }

    const plugin = getOneSignalPlugin();
    if (!plugin) {
      console.warn('[PushNotifications] BioPeakOneSignal plugin not available');
      setState(prev => ({ ...prev, error: 'OneSignal plugin not available' }));
      return;
    }

    try {
      console.log('[PushNotifications] Initializing OneSignal via native plugin...');
      
      // Initialize the plugin (it auto-initializes on load, but we call it anyway)
      const initResult = await plugin.initialize();
      console.log('[PushNotifications] Initialize result:', initResult);

      // Set up notification click listener
      plugin.addListener('notificationClicked', (data) => {
        console.log('[PushNotifications] Notification clicked:', data);
        if (data.additionalData) {
          try {
            const additionalData = JSON.parse(data.additionalData);
            if (additionalData.route) {
              window.location.href = additionalData.route;
            }
          } catch (e) {
            console.error('[PushNotifications] Error parsing additional data:', e);
          }
        }
      });

      // Get current player ID
      const playerInfo = await plugin.getPlayerId();
      console.log('[PushNotifications] Player info:', playerInfo);
      
      if (playerInfo.playerId) {
        await savePlayerIdToSupabase(playerInfo.playerId);
        setState(prev => ({
          ...prev,
          isInitialized: true,
          playerId: playerInfo.playerId,
          isSubscribed: playerInfo.optedIn,
          isSupported: true,
        }));
        console.log('[PushNotifications] ✅ Initialized with player ID:', playerInfo.playerId);
      } else {
        setState(prev => ({
          ...prev,
          isInitialized: true,
          isSupported: true,
        }));
        console.log('[PushNotifications] ✅ Initialized (no player ID yet)');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize OneSignal';
      console.error('[PushNotifications] Initialization error:', error);
      setState(prev => ({ ...prev, error: errorMessage }));
    }
  }, [isNative, getOneSignalPlugin, savePlayerIdToSupabase]);

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
    const plugin = getOneSignalPlugin();
    if (!plugin) {
      console.warn('[PushNotifications] Plugin not available for permission request');
      return false;
    }

    try {
      console.log('[PushNotifications] Requesting permission...');
      const result = await plugin.requestPermission();
      console.log('[PushNotifications] Permission result:', result);
      
      if (result.granted) {
        // Re-fetch player ID after permission granted
        const playerInfo = await plugin.getPlayerId();
        if (playerInfo.playerId) {
          await savePlayerIdToSupabase(playerInfo.playerId);
          setState(prev => ({
            ...prev,
            isSubscribed: true,
            playerId: playerInfo.playerId,
          }));
        }
      }

      setState(prev => ({ ...prev, isSubscribed: result.granted }));
      return result.granted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request permission';
      console.error('[PushNotifications] Permission request error:', error);
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [getOneSignalPlugin, savePlayerIdToSupabase]);

  const setExternalUserId = useCallback(async (userId: string) => {
    const plugin = getOneSignalPlugin();
    if (!plugin) {
      console.warn('[PushNotifications] Plugin not available for external user ID');
      return;
    }

    try {
      console.log('[PushNotifications] Setting external user ID:', userId);
      await plugin.login({ userId });
      console.log('[PushNotifications] ✅ External user ID set successfully');

      // Update player ID after login
      const playerInfo = await plugin.getPlayerId();
      if (playerInfo.playerId) {
        await savePlayerIdToSupabase(playerInfo.playerId);
        setState(prev => ({ ...prev, playerId: playerInfo.playerId }));
      }
    } catch (error) {
      console.error('[PushNotifications] Error setting external user ID:', error);
    }
  }, [getOneSignalPlugin, savePlayerIdToSupabase]);

  const clearExternalUserId = useCallback(async () => {
    const plugin = getOneSignalPlugin();
    if (!plugin) return;

    try {
      console.log('[PushNotifications] Clearing external user ID (logout)');
      await plugin.logout();
      console.log('[PushNotifications] ✅ External user ID cleared');
    } catch (error) {
      console.error('[PushNotifications] Error clearing external user ID:', error);
    }
  }, [getOneSignalPlugin]);

  const setUserTags = useCallback(async (tags: Record<string, string>) => {
    const plugin = getOneSignalPlugin();
    if (!plugin) {
      console.warn('[PushNotifications] Plugin not available for tags');
      return;
    }

    try {
      console.log('[PushNotifications] Setting user tags:', tags);
      await plugin.addTags({ tags });
      console.log('[PushNotifications] ✅ User tags set successfully');
    } catch (error) {
      console.error('[PushNotifications] Error setting user tags:', error);
    }
  }, [getOneSignalPlugin]);

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
