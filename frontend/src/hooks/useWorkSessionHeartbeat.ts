import { useEffect, useRef } from 'react';
import { workSessionsService } from '../services/work-sessions.service';

/**
 * useWorkSessionHeartbeat
 *
 * Çok basit heartbeat gönderici:
 * - Her 30 saniyede bir ONLINE_ACTIVE heartbeat gönderir
 * - Sekme görünürlük/odak değişimlerinde tetiklenir
 * - İnternet bağlantısı geri geldiğinde tetiklenir
 * - Sayfa kapanırken sendBeacon ile son durumu gönderir
 *
 * NOT: Kullanıcı asla otomatik molaya/boşa düşürülmez.
 * Tüm duraklatma/bitirme işlemleri sadece manueldir.
 */

const HEARTBEAT_INTERVAL_MS = 30000;

interface UseHeartbeatOptions {
  /** Oturum aktif mi? */
  isSessionActive: boolean;
  /** Her heartbeat sonrası çağrılır */
  onUpdate?: () => void;
}

export function useWorkSessionHeartbeat({
  isSessionActive,
  onUpdate,
}: UseHeartbeatOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionActiveRef = useRef<boolean>(isSessionActive);
  const callbacksRef = useRef({ onUpdate });
  callbacksRef.current = { onUpdate };

  sessionActiveRef.current = isSessionActive;

  const sendHeartbeat = async () => {
    if (!sessionActiveRef.current) return;
    try {
      await workSessionsService.sendHeartbeat('ONLINE_ACTIVE');
      callbacksRef.current.onUpdate?.();
    } catch {
      // Oturum sonlanmış olabilir
    }
  };

  useEffect(() => {
    if (!isSessionActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    const handleVisibility = () => {
      if (!document.hidden && sessionActiveRef.current) sendHeartbeat();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleFocus = () => {
      if (sessionActiveRef.current) sendHeartbeat();
    };
    window.addEventListener('focus', handleFocus);

    const handleOnline = () => {
      if (sessionActiveRef.current) sendHeartbeat();
    };
    window.addEventListener('online', handleOnline);

    const handlePageHide = () => {
      if (sessionActiveRef.current) {
        const url = `${import.meta.env.VITE_API_URL ?? '/api'}/work-sessions/sync`;
        const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
        try { navigator.sendBeacon(url, blob); } catch { /* */ }
      }
    };
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pagehide', handlePageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionActive]);
}
