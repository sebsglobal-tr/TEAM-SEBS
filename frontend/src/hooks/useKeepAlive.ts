import { useEffect, useRef } from 'react';

/**
 * Kullanıcı sayfadayken Render'ın uykuya dalmasını engeller.
 * Her 4 dakikada bir /api/health endpoint'ine ping atar.
 * GitHub Actions ile birlikte çalışır:
 *   - GitHub Actions: 7/24 her 10 dk'da bir ping (arka planda)
 *   - useKeepAlive: Kullanıcı aktifken her 4 dk'da bir ping
 */
export function useKeepAlive() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const ping = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL ?? '/api';
        const res = await fetch(`${baseUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          console.debug('[KeepAlive] Render uyanık ✅');
        }
      } catch {
        // Sessiz — sadece keep-alive, hata önemli değil
      }
    };

    // İlk ping hemen
    ping();

    // 4 dakikada bir tekrarla (Render 15dk'da uyur, 4dk güvenli)
    intervalRef.current = setInterval(ping, 4 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
