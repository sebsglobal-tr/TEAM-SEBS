import { useState, useCallback, useRef, useEffect } from 'react';
import { workSessionsService } from '../services/work-sessions.service';
import { useWorkSessionHeartbeat } from './useWorkSessionHeartbeat';
import type { WorkSessionToday } from '../types';

/**
 * Paylaşımlı çalışma oturumu hook'u.
 * Hem EmployeeDashboard hem EmployeeTimer aynı mantığı kullanır.
 *
 * Kullanım:
 *   const ws = useWorkSession();
 *   <button onClick={ws.start}>Başlat</button>
 *   {ws.error && <div>{ws.error}</div>}
 *   <div>{ws.formattedTime}</div>
 */
export function useWorkSession() {
  const [session, setSession] = useState<WorkSessionToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [stopLoading, setStopLoading] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Backend'den session verilerini çek ───

  const loadSession = useCallback(async () => {
    try {
      const s = await workSessionsService.getToday();
      setSession(s);
    } catch (err) {
      console.error('Session yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Hata mesajını 5sn sonra temizle ───

  const showError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  }, []);

  // ─── Yardımcı: hatadan okunabilir mesaj çıkar ───

  const extractError = useCallback((err: any, fallback: string): string => {
    if (err?.response?.data?.message) {
      const msg = err.response.data.message;
      return typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : fallback;
    }
    if (err?.message === 'Network Error') return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
    return fallback;
  }, []);

  // ─── İlk yükleme ───

  useEffect(() => { loadSession(); }, [loadSession]);

  // ─── Gerçek zamanlı sayaç ───

  const activeSession = session?.activeSession;
  const isOnBreak = session?.isOnBreak ?? false;
  const isSessionActive = !!activeSession && activeSession.status === 'ACTIVE';
  const isPaused = activeSession?.status === 'PAUSED';

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'ACTIVE') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplaySeconds(activeSession?.totalActiveSeconds ?? 0);
      return;
    }

    const calcElapsed = () => {
      if (session?.isOnBreak) {
        setDisplaySeconds(activeSession.totalActiveSeconds);
        return;
      }
      const refTime = activeSession.lastResumedAt
        ? new Date(activeSession.lastResumedAt).getTime()
        : new Date(activeSession.startedAt).getTime();
      const elapsed = Math.max(0, Math.floor((Date.now() - refTime) / 1000));
      setDisplaySeconds(activeSession.totalActiveSeconds + elapsed);
    };

    calcElapsed();
    intervalRef.current = setInterval(calcElapsed, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession, session?.isOnBreak]);

  // ─── Heartbeat ───

  useWorkSessionHeartbeat({
    isSessionActive,
    onUpdate: loadSession,
  });

  // ─── Format helper ───

  const formatHHMMSS = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Ana aksiyonlar ───

  const handleAction = useCallback(async (
    action: () => Promise<unknown>,
    onSuccess?: () => void,
  ) => {
    setActionLoading(true);
    setError('');
    try {
      await action();
      onSuccess?.();
      await loadSession();
    } catch (err: any) {
      console.error('İşlem hatası:', err);
      showError(extractError(err, 'İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.'));
    } finally {
      setActionLoading(false);
    }
  }, [loadSession, showError, extractError]);

  const start = useCallback(() => {
    console.log('[WORK_TIMER] Start button CLICKED', {
      page: window.location.pathname,
      timestamp: new Date().toISOString(),
      hasActiveSession: !!activeSession,
      handleActionType: typeof handleAction,
      apiType: typeof workSessionsService.start,
    });

    // handleAction undefined kontrolü
    if (typeof handleAction !== 'function') {
      console.error('[WORK_TIMER] CRITICAL: handleAction is NOT a function!');
      setError('Sistem hatası: handleAction tanımlı değil. Sayfayı yenileyin.');
      return;
    }

    try {
      const promise = handleAction(() => workSessionsService.start());
      console.log('[WORK_TIMER] handleAction returned:', promise ? 'Promise' : 'undefined', 'type:', typeof promise);
    } catch (err) {
      console.error('[WORK_TIMER] CRITICAL: handleAction threw synchronously:', err);
      setError('Sistem hatası: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [handleAction, activeSession, setError]);

  const stop = useCallback(async () => {
    setStopLoading(true);
    setError('');
    try {
      await workSessionsService.stop();
      setDisplaySeconds(0);
      await loadSession();
    } catch (err: any) {
      console.error('Durdurma hatası:', err);
      showError(extractError(err, 'Oturum sonlandırılırken hata oluştu.'));
    } finally {
      setStopLoading(false);
    }
  }, [loadSession, showError, extractError]);

  const pause = useCallback(() =>
    handleAction(() => workSessionsService.pause()),
  [handleAction]);

  const resume = useCallback(async () => {
    setActionLoading(true);
    setError('');
    try {
      await workSessionsService.resume();
      await loadSession();
    } catch (err) {
      console.error('Devam ettirme hatası:', err);
      await loadSession();
    } finally {
      setActionLoading(false);
    }
  }, [loadSession]);

  const startBreak = useCallback(() =>
    handleAction(() => workSessionsService.startBreak()),
  [handleAction]);

  const endBreak = useCallback(() =>
    handleAction(() => workSessionsService.endBreak()),
  [handleAction]);

  return {
    // Veri
    session,
    activeSession,
    loading,
    actionLoading,
    stopLoading,
    error,
    displaySeconds,
    isOnBreak,
    isSessionActive,
    isPaused,

    // Aksiyonlar
    start,
    stop,
    pause,
    resume,
    startBreak,
    endBreak,
    loadSession,

    // Yardımcılar
    formatHHMMSS,
    setDisplaySeconds,
    setError,
    setStopLoading,
  };
}
