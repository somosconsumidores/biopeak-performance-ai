import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationProviderProps {
  children: React.ReactNode;
}

export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  const { user } = useAuth();
  const { 
    isInitialized,
    setExternalUserId, 
    clearExternalUserId,
    requestPermission,
    initializeOneSignal,
  } = usePushNotifications();
  
  const hasSetExternalUserId = useRef(false);
  const isNative = Capacitor.isNativePlatform();

  // Initialize OneSignal and handle user authentication
  useEffect(() => {
    if (!isNative) {
      console.log('[PushNotificationProvider] Skipping - not native platform');
      return;
    }

    const handlePushNotifications = async () => {
      if (user && isInitialized && !hasSetExternalUserId.current) {
        console.log('[PushNotificationProvider] Setting external user ID:', user.id);
        await setExternalUserId(user.id);
        hasSetExternalUserId.current = true;
        
        // Request permission after setting user
        const granted = await requestPermission();
        console.log('[PushNotificationProvider] Permission granted:', granted);
      } else if (!user && hasSetExternalUserId.current) {
        console.log('[PushNotificationProvider] Clearing external user ID (logout)');
        await clearExternalUserId();
        hasSetExternalUserId.current = false;
      }
    };

    handlePushNotifications();
  }, [user, isInitialized, isNative, setExternalUserId, clearExternalUserId, requestPermission]);

  // Force initialization if not already done
  useEffect(() => {
    if (isNative && user && !isInitialized) {
      console.log('[PushNotificationProvider] Force initializing OneSignal...');
      initializeOneSignal();
    }
  }, [isNative, user, isInitialized, initializeOneSignal]);

  return <>{children}</>;
}
