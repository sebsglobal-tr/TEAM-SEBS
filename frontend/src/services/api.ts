import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ──────────────────────────────────────────────
//  PROAKTİF TOKEN YENİLEME
// ──────────────────────────────────────────────

/**
 * JWT token'ın `exp` (expiration) claim'ini döndürür (saniye cinsinden UNIX timestamp).
 * Geçersizse null döner.
 */
function getTokenExpiration(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

/**
 * Access token'ın süresi 5 dakika içinde dolacaksa refresh yap.
 * Bu, 401 almamızı engelleyerek kullanıcının oturumdan atılmamasını sağlar.
 */
let refreshPromise: Promise<void> | null = null;

async function ensureValidToken(): Promise<void> {
  const accessToken = localStorage.getItem('accessToken');
  if (!accessToken) return;

  const exp = getTokenExpiration(accessToken);
  if (!exp) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const fiveMinFromNow = nowSec + 300; // 5 dakika

  // Token 5 dakikadan daha kısa sürede dolacaksa → yenile
  if (exp > fiveMinFromNow) return;

  // Aynı anda birden fazla refresh isteğini önle
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) throw new Error('Refresh token yok');

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
      } catch {
        // Refresh başarısız → temizlik yapma, sadece promise'i düşür
        // Esas 401 handler'ı response interceptor'da halledecek
        throw new Error('Token yenileme başarısız');
      }
    })();
  }

  try {
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// ──────────────────────────────────────────────
//  REQUEST INTERCEPTOR
// ──────────────────────────────────────────────

api.interceptors.request.use(
  async (config) => {
    // Her istekten önce token'ın geçerliliğini kontrol et
    // (401 önleme — proaktif refresh)
    await ensureValidToken();

    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ──────────────────────────────────────────────
//  RESPONSE INTERCEPTOR (401 → refresh → retry)
// ──────────────────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Sadece 401 hatalarını ele al — refresh endpoint'ini tekrar arama
    if (error.response?.status === 401 && !original._retry && !original._isRefreshRequest) {
      original._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          // Refresh token da geçersiz → sadece temizle, logout zorlama
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          // Sayfayı yeniden yönlendirme — kullanıcı manuel login olabilir
          // window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  },
);
