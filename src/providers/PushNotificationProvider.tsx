import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOneSignalPush } from '@/hooks/useOneSignalPush';
import { supabase } from '@/integrations/supabase/client';
import { Device } from '@capacitor/device';

interface PushNotificationContextType {
  isSupported: boolean;
  isInitialized: boolean;
  hasPermission: boolean;
  isLoggedIn: boolean;
  subscriptionId: string | null;
  requestPermission: () => Promise<boolean>;
}

const PushNotificationContext = createContext<PushNotificationContextType | undefined>(undefined);

interface PushNotificationProviderProps {
  children: ReactNode;
}

export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  const { user } = useAuth();
  const {
    isSupported,
    isInitialized,
    hasPermission,
    isLoggedIn,
    subscriptionId,
    initialize,
    login,
    logout,
    requestPermission,
  } = useOneSignalPush();

  const [hasAutoInitialized, setHasAutoInitialized] = useState(false);
  const [hasSavedToken, setHasSavedToken] = useState(false);

  // Save token to database
  const saveTokenToDatabase = useCallback(async (userId: string, playerId: string) => {
    try {
      console.log('[PushNotificationProvider] Saving token to database...');
      
      // Get device info
      const deviceInfo = await Device.getInfo();
      
      // Upsert: update if exists, insert if not
      const { error } = await supabase
        .from('push_notification_tokens')
        .upsert({
          user_id: userId,
          player_id: playerId,
          platform: 'android',
          device_model: deviceInfo.model || 'unknown',
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform',
        });

      if (error) {
        console.error('[PushNotificationProvider] Failed to save token:', error);
      } else {
        console.log('[PushNotificationProvider] Token saved successfully');
        setHasSavedToken(true);
      }
    } catch (error) {
      console.error('[PushNotificationProvider] Error saving token:', error);
    }
  }, []);

  // Deactivate token on logout
  const deactivateToken = useCallback(async (userId: string) => {
    try {
      console.log('[PushNotificationProvider] Deactivating token...');
      await supabase
        .from('push_notification_tokens')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    } catch (error) {
      console.error('[PushNotificationProvider] Error deactivating token:', error);
    }
  }, []);

  // Auto-initialize OneSignal on mount (Android only)
  useEffect(() => {
    if (!isSupported || hasAutoInitialized) return;

    const doInit = async () => {
      console.log('[PushNotificationProvider] Auto-initializing OneSignal...');
      const success = await initialize();
      if (success) {
        setHasAutoInitialized(true);
        console.log('[PushNotificationProvider] OneSignal initialized successfully');
      }
    };

    // Small delay to ensure native plugins are ready
    const timer = setTimeout(doInit, 1000);
    return () => clearTimeout(timer);
  }, [isSupported, hasAutoInitialized, initialize]);

  // Auto-login when user authenticates
  useEffect(() => {
    if (!isSupported || !isInitialized) return;

    if (user && !isLoggedIn) {
      console.log('[PushNotificationProvider] User authenticated, logging in to OneSignal...');
      login(user.id).then(async (success) => {
        if (success) {
          // Wait for OneSignal to sync the login with their server before requesting permission
          console.log('[PushNotificationProvider] Waiting for OneSignal sync...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          console.log('[PushNotificationProvider] Requesting notification permission...');
          await requestPermission();
        }
      });
    } else if (!user && isLoggedIn) {
      console.log('[PushNotificationProvider] User logged out, logging out of OneSignal...');
      logout();
    }
  }, [user, isSupported, isInitialized, isLoggedIn, login, logout, requestPermission]);

  // Save token when we have user, subscriptionId and permission
  useEffect(() => {
    if (user && subscriptionId && hasPermission && !hasSavedToken) {
      saveTokenToDatabase(user.id, subscriptionId);
    }
  }, [user, subscriptionId, hasPermission, hasSavedToken, saveTokenToDatabase]);

  // Reset saved token flag and deactivate on logout
  useEffect(() => {
    if (!user && hasSavedToken) {
      setHasSavedToken(false);
    }
  }, [user, hasSavedToken, deactivateToken]);

  const contextValue: PushNotificationContextType = {
    isSupported,
    isInitialized,
    hasPermission,
    isLoggedIn,
    subscriptionId,
    requestPermission,
  };

  return (
    <PushNotificationContext.Provider value={contextValue}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotifications() {
  const context = useContext(PushNotificationContext);
  if (context === undefined) {
    throw new Error('usePushNotifications must be used within a PushNotificationProvider');
  }
  return context;
}
