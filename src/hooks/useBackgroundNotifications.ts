import { useState, useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

interface NotificationOptions {
  enabled: boolean;
}

interface NotificationState {
  isSupported: boolean;
  hasPermission: boolean;
  error: string | null;
}

/**
 * Hook for local notifications during background sessions.
 * This is used for immediate in-session notifications (pace alerts, etc.)
 * For push notifications from server, use usePushNotifications instead.
 */
export const useBackgroundNotifications = ({ enabled }: NotificationOptions) => {
  const [state, setState] = useState<NotificationState>({
    isSupported: false,
    hasPermission: false,
    error: null,
  });

  useEffect(() => {
    const checkSupport = async () => {
      const isNative = Capacitor.isNativePlatform();
      setState(prev => ({ ...prev, isSupported: isNative }));

      if (isNative && enabled) {
        await requestPermission();
      }
    };

    checkSupport();
  }, [enabled]);

  const requestPermission = async () => {
    try {
      const result = await LocalNotifications.requestPermissions();
      const hasPermission = result.display === 'granted';
      
      setState(prev => ({ 
        ...prev, 
        hasPermission,
        error: hasPermission ? null : 'Notification permission denied'
      }));

      return hasPermission;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request notification permission';
      setState(prev => ({ ...prev, error: errorMessage }));
      console.error('Notification permission error:', error);
      return false;
    }
  };

  const scheduleNotification = async (options: {
    title: string;
    body: string;
    id?: number;
    sound?: boolean;
  }) => {
    if (!state.isSupported || !state.hasPermission) {
      console.warn('Notifications not available or no permission');
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: options.title,
            body: options.body,
            id: options.id || Date.now(),
            schedule: { at: new Date(Date.now() + 100) }, // Schedule immediately
            sound: options.sound ? undefined : null,
            attachments: undefined,
            actionTypeId: '',
            extra: null,
          },
        ],
      });
    } catch (error) {
      console.error('Failed to schedule notification:', error);
    }
  };

  const cancelAllNotifications = async () => {
    if (!state.isSupported) return;

    try {
      await LocalNotifications.cancel({ notifications: [] });
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  };

  return {
    ...state,
    requestPermission,
    scheduleNotification,
    cancelAllNotifications,
  };
};
