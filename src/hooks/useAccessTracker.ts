import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useHibernationDetection } from './useHibernationDetection';

type AccessType = 'login' | 'session_resume' | 'app_resume';

interface TrackAccessOptions {
  accessType: AccessType;
  minIntervalHours?: number;
}

export const useAccessTracker = () => {
  const hasTrackedSession = useRef(false);
  const { isHibernated } = useHibernationDetection({
    onRecovery: () => {
      trackAccess({ accessType: 'app_resume', minIntervalHours: 0.5 }); // 30 minutes for app resume
    },
    threshold: 5 * 60 * 1000, // 5 minutes hibernation threshold
  });

  const trackAccess = async (options: TrackAccessOptions) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('track-user-access', {
        body: {
          access_type: options.accessType,
          min_interval_hours: options.minIntervalHours || 1,
        },
      });

      if (response.error) {
        console.error('Error tracking access:', response.error);
      } else {
        console.log(`Access tracked: ${options.accessType}`);
      }
    } catch (error) {
      console.error('Failed to track access:', error);
    }
  };

  const trackSessionResume = () => {
    if (!hasTrackedSession.current) {
      hasTrackedSession.current = true;
      trackAccess({ accessType: 'session_resume', minIntervalHours: 1 });
    }
  };

  const trackLogin = () => {
    hasTrackedSession.current = true;
    trackAccess({ accessType: 'login', minIntervalHours: 0 }); // Always track explicit logins
  };

  // Track existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !hasTrackedSession.current) {
        trackSessionResume();
      }
    };

    checkExistingSession();
  }, []);

  return {
    trackLogin,
    trackSessionResume,
    trackAccess,
  };
};