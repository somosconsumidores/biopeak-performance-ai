import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOneSignalPush } from '@/hooks/useOneSignalPush';
import { supabase } from '@/integrations/supabase/client';
import { Device, DeviceInfo } from '@capacitor/device';

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
    isOptedIn,
    initialize,
    login,
    logout,
    requestPermission,
  } = useOneSignalPush();

  const [hasAutoInitialized, setHasAutoInitialized] = useState(false);
  const [hasSavedToken, setHasSavedToken] = useState(false);
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const loginAttemptedRef = useRef(false);

  // Pre-load device info on mount (before any OneSignal operations)
  useEffect(() => {
    Device.getInfo().then(info => {
      console.log('[PushNotificationProvider] Device info pre-loaded:', info.model);
      setDeviceInfo(info);
    }).catch(err => {
      console.error('[PushNotificationProvider] Failed to get device info:', err);
    });
  }, []);

  // Save token to database - uses pre-loaded deviceInfo
  const saveTokenToDatabase = useCallback(async (userId: string, playerId: string) => {
    try {
      // Detect platform correctly from deviceInfo
      const platform = deviceInfo?.platform || 'unknown';
      console.log('[PushNotificationProvider] Saving token to database...', { platform, model: deviceInfo?.model });
      
      // Upsert: update if exists, insert if not
      const { error } = await supabase
        .from('push_notification_tokens')
        .upsert({
          user_id: userId,
          player_id: playerId,
          platform: platform,
          device_model: deviceInfo?.model || 'unknown',
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
  }, [deviceInfo]);

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

  // NOVO FLUXO: Permission/Subscription ANTES do Login
  // Efeito 1: Pedir permissão quando user autentica (mas ANTES de fazer login no OneSignal)
  useEffect(() => {
    if (!isSupported || !isInitialized || !user || hasRequestedPermission) return;
    
    console.log('[PushNotificationProvider] User authenticated, requesting permission FIRST...');
    requestPermission().then((granted) => {
      setHasRequestedPermission(true);
      console.log('[PushNotificationProvider] Permission result:', granted);
    });
  }, [user, isSupported, isInitialized, hasRequestedPermission, requestPermission]);

  // Efeito para resetar loginAttemptedRef quando isOptedIn muda para true
  // Isso permite retry se o primeiro login aconteceu antes do optedIn
  useEffect(() => {
    if (isOptedIn && subscriptionId && user && !isLoggedIn && loginAttemptedRef.current) {
      console.log('[PushNotificationProvider] isOptedIn became true after previous attempt, allowing retry...');
      loginAttemptedRef.current = false;
    }
  }, [isOptedIn, subscriptionId, user, isLoggedIn]);

  // Efeito 2: Fazer login SOMENTE quando subscription está COMPLETAMENTE pronta
  // CRÍTICO: Aguardar TODOS os requisitos:
  // - subscriptionId existe (subscription criada)
  // - isOptedIn === true (subscription opted-in, token FCM sincronizado)
  // - hasPermission === true (permissão concedida)
  useEffect(() => {
    if (!isSupported || !isInitialized || !user || isLoggedIn) return;
    
    if (!subscriptionId || !isOptedIn || !hasPermission) {
      console.log('[PushNotificationProvider] Subscription not fully ready:', {
        subscriptionId: !!subscriptionId,
        isOptedIn,
        hasPermission
      });
      return;
    }
    
    if (loginAttemptedRef.current) return;
    
    loginAttemptedRef.current = true;
    console.log('[PushNotificationProvider] Subscription FULLY ready (ID: ' + subscriptionId.substring(0, 8) + '..., optedIn: true), NOW logging in with external ID...');
    login(user.id);
  }, [user, isSupported, isInitialized, isLoggedIn, subscriptionId, isOptedIn, hasPermission, login]);

  // Efeito 3: Logout quando user desautentica
  useEffect(() => {
    if (!user && isLoggedIn) {
      console.log('[PushNotificationProvider] User logged out, logging out of OneSignal...');
      logout();
      setHasRequestedPermission(false);
      loginAttemptedRef.current = false;
    }
  }, [user, isLoggedIn, logout]);

  // Save token ONLY AFTER OneSignal login is confirmed (with delay to ensure sync)
  useEffect(() => {
    if (user && subscriptionId && hasPermission && isLoggedIn && isOptedIn && !hasSavedToken) {
      console.log('[PushNotificationProvider] OneSignal login confirmed, waiting 2s before saving token...');
      const timer = setTimeout(() => {
        saveTokenToDatabase(user.id, subscriptionId);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, subscriptionId, hasPermission, isLoggedIn, isOptedIn, hasSavedToken, saveTokenToDatabase]);

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
