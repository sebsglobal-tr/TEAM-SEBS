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
  // useRef ile error callback stabil kalır
  const showErrorRef = useRef<(msg: string) => void>(() => {});

  // ─── Backend'den session verilerini çek ───

  const loadSession = useCallback(async () => {
    try {
      const s = await workSessionsService.getToday();
      setSession(s);
    } catch (err) {
      console.error('[SESSION] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Hata mesajını 5sn sonra temizle ───

  const showError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  }, []);

  showErrorRef.current = showError;

  // ─── Yardımcı: hatadan okunabilir mesaj çıkar ───

  const extractError = useCallback((err: any, fallback: string): string => {
    if (err?.response?.data?.message) {
      const msg = err.response.data.message;
      return typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : fallback;
    }
    if (err?.message === 'Network Error') return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
    if (err?.code === 'ECONNABORTED') return 'Sunucu yanıt vermiyor. Lütfen tekrar deneyin.';
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

  /**
   * 📌 MERKEZİ BAŞLATMA FONKSİYONU
   * Hem EmployeeDashboard hem EmployeeTimer bu fonksiyonu kullanır.
   *
   * Akış:
   * 1. Buton loading'e geçer
   * 2. Doğrudan API isteği atılır (axios interceptor bypass edilmez, timeout eklenir)
   * 3. Başarılı → session yeniden yüklenir, sayaç başlar
   * 4. Başarısız → hata mesajı gösterilir
   */
  const start = useCallback(async () => {
    console.log('[WORK_TIMER] 1️⃣ Start button CLICKED', {
      page: window.location.pathname,
      timestamp: new Date().toISOString(),
      hasActiveSession: !!activeSession,
    });

    if (activeSession) {
      console.warn('[WORK_TIMER] Active session already exists, skipping');
      showErrorRef.current('Zaten aktif bir çalışma oturumunuz bulunuyor.');
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      console.log('[WORK_TIMER] 2️⃣ Calling API: POST /work-sessions/start');
      const result = await workSessionsService.start();
      console.log('[WORK_TIMER] 3️⃣ API RESPONSE:', result);

      // Session'ı yeniden yükle
      await loadSession();
      console.log('[WORK_TIMER] 4️⃣ Session reloaded successfully');
    } catch (err: any) {
      console.error('[WORK_TIMER] ❌ Start FAILED:', err?.message, err?.response?.status, err?.response?.data);
      const msg = extractError(err, 'Çalışma başlatılamadı. Lütfen tekrar deneyin.');
      showErrorRef.current(msg);
    } finally {
      setActionLoading(false);
      console.log('[WORK_TIMER] 5️⃣ handleAction FINALLY completed');
    }
  }, [activeSession, loadSession, extractError]);

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

  const pause = useCallback(async () => {
    setActionLoading(true);
    setError('');
    try {
      await workSessionsService.pause();
      await loadSession();
    } catch (err: any) {
      console.error('Duraklatma hatası:', err);
      showError(extractError(err, 'Duraklatma sırasında hata oluştu.'));
    } finally {
      setActionLoading(false);
    }
  }, [loadSession, showError, extractError]);

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

  const startBreak = useCallback(async () => {
    setActionLoading(true);
    setError('');
    try {
      await workSessionsService.startBreak();
      await loadSession();
    } catch (err: any) {
      console.error('Mola başlatma hatası:', err);
      showError(extractError(err, 'Mola başlatılamadı.'));
    } finally {
      setActionLoading(false);
    }
  }, [loadSession, showError, extractError]);

  const endBreak = useCallback(async () => {
    setActionLoading(true);
    setError('');
    try {
      await workSessionsService.endBreak();
      await loadSession();
    } catch (err: any) {
      console.error('Mola bitirme hatası:', err);
      showError(extractError(err, 'Mola bitirilemedi.'));
    } finally {
      setActionLoading(false);
    }
  }, [loadSession, showError, extractError]);

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
