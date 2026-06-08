import { useEffect, useRef, useCallback } from 'react';
import { workSessionsService } from '../services/work-sessions.service';
import type { EmployeeStatus } from '../types';

const HEARTBEAT_INTERVAL_MS = 30000;
const IDLE_BREAK_THRESHOLD_MS = 180_000; // 3 dakika

interface UseHeartbeatOptions {
  isSessionActive: boolean;
  isOnBreak: boolean;
  onUpdate?: () => void;
  onAutoBreakStart?: () => void;
  onAutoBreakEnd?: () => void;
}

export function useWorkSessionHeartbeat({
  isSessionActive,
  isOnBreak,
  onUpdate,
  onAutoBreakStart,
  onAutoBreakEnd,
}: UseHeartbeatOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const autoBreakRef = useRef<boolean>(false);

  // Keep latest callbacks in refs to avoid re-creating the effect
  const callbacksRef = useRef({ onUpdate, onAutoBreakStart, onAutoBreakEnd });
  callbacksRef.current = { onUpdate, onAutoBreakStart, onAutoBreakEnd };

  // Reset activity timer on user interaction
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();

    // If user becomes active again while on auto-break → end it
    if (autoBreakRef.current) {
      autoBreakRef.current = false;
      callbacksRef.current.onAutoBreakEnd?.();
    }
  }, []);

  useEffect(() => {
    if (!isSessionActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Activity events to listen to
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetActivity));

    const sendHeartbeat = async () => {
      const now = Date.now();
      const idleMs = now - lastActivityRef.current;

      // Auto-break check: idle for 3+ min and not already on break
      if (idleMs >= IDLE_BREAK_THRESHOLD_MS && !isOnBreak && !autoBreakRef.current) {
        autoBreakRef.current = true;
        callbacksRef.current.onAutoBreakStart?.();
        return; // wait for break to be active before sending heartbeat
      }

      let status: EmployeeStatus = 'ONLINE_ACTIVE';

      if (isOnBreak || autoBreakRef.current) {
        status = 'ON_BREAK';
      } else if (document.hidden || idleMs >= IDLE_BREAK_THRESHOLD_MS) {
        status = 'ONLINE_IDLE';
      }

      try {
        await workSessionsService.sendHeartbeat(status);
        callbacksRef.current.onUpdate?.();
      } catch {
        // Session may have ended
      }
    };

    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    const handleVisibility = () => {
      if (!document.hidden && !isOnBreak) {
        resetActivity();
        sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetActivity));
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // Only re-run when session active/break state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionActive, isOnBreak]);
}
