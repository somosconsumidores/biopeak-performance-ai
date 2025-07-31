import { useState, useEffect, useRef, useCallback } from 'react';

interface HibernationEvent {
  type: 'hibernation' | 'recovery';
  duration: number; // milliseconds
  timestamp: number;
}

interface HibernationOptions {
  onHibernation?: (event: HibernationEvent) => void;
  onRecovery?: (event: HibernationEvent) => void;
  threshold?: number; // milliseconds to consider as hibernation
}

export const useHibernationDetection = ({
  onHibernation,
  onRecovery,
  threshold = 30000, // 30 seconds
}: HibernationOptions = {}) => {
  const [isHibernated, setIsHibernated] = useState(false);
  const [lastHibernation, setLastHibernation] = useState<HibernationEvent | null>(null);
  const lastActiveTimeRef = useRef(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hibernationStartRef = useRef<number | null>(null);

  const checkActivity = useCallback(() => {
    const now = Date.now();
    const timeDiff = now - lastActiveTimeRef.current;

    if (timeDiff > threshold && !isHibernated) {
      // Hibernation detected
      const event: HibernationEvent = {
        type: 'hibernation',
        duration: timeDiff,
        timestamp: now,
      };
      
      setIsHibernated(true);
      setLastHibernation(event);
      hibernationStartRef.current = now;
      onHibernation?.(event);
    }
  }, [threshold, isHibernated, onHibernation]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    lastActiveTimeRef.current = now;

    if (isHibernated && hibernationStartRef.current) {
      // Recovery detected
      const hibernationDuration = now - hibernationStartRef.current;
      const event: HibernationEvent = {
        type: 'recovery',
        duration: hibernationDuration,
        timestamp: now,
      };

      setIsHibernated(false);
      hibernationStartRef.current = null;
      onRecovery?.(event);
    }
  }, [isHibernated, onRecovery]);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      handleActivity();
    }
  }, [handleActivity]);

  useEffect(() => {
    // Set up activity detection
    intervalRef.current = setInterval(checkActivity, 5000); // Check every 5 seconds

    // Listen to various activity events
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Listen to visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen to page focus/blur
    window.addEventListener('focus', handleActivity);
    window.addEventListener('blur', handleActivity);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleActivity);
      window.removeEventListener('blur', handleActivity);
    };
  }, [checkActivity, handleActivity, handleVisibilityChange]);

  return {
    isHibernated,
    lastHibernation,
  };
};