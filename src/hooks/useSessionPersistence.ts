import { useState, useEffect, useCallback } from 'react';
import { SessionData } from './useRealtimeSession';

const SESSION_STORAGE_KEY = 'biopeak_training_session';
const RECOVERY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

interface SessionRecovery {
  sessionData: SessionData;
  timestamp: number;
  lastSavedDistance: number;
  wasRecording: boolean;
}

export const useSessionPersistence = () => {
  const [pendingRecovery, setPendingRecovery] = useState<SessionRecovery | null>(null);

  // Save session state
  const saveSessionState = useCallback((
    sessionData: SessionData | null,
    isRecording: boolean,
    currentDistance: number
  ) => {
    if (!sessionData) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    const recovery: SessionRecovery = {
      sessionData,
      timestamp: Date.now(),
      lastSavedDistance: currentDistance,
      wasRecording: isRecording,
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(recovery));
  }, []);

  // Check for recoverable session
  const checkForRecoverableSession = useCallback(() => {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;

      const recovery: SessionRecovery = JSON.parse(stored);
      const timeDiff = Date.now() - recovery.timestamp;

      // Only recover if session was recent and not completed
      if (timeDiff < RECOVERY_THRESHOLD_MS && 
          recovery.sessionData.status !== 'completed' &&
          recovery.sessionData.status !== 'cancelled') {
        return recovery;
      }

      // Clean up old sessions
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  }, []);

  // Clear saved session
  const clearSavedSession = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setPendingRecovery(null);
  }, []);

  // Check for recovery on mount
  useEffect(() => {
    const recovery = checkForRecoverableSession();
    if (recovery) {
      setPendingRecovery(recovery);
    }
  }, [checkForRecoverableSession]);

  return {
    pendingRecovery,
    saveSessionState,
    clearSavedSession,
    checkForRecoverableSession,
  };
};