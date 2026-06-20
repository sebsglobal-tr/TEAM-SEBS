import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { authService } from '../services/auth.service';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isSuperAdmin: boolean;
  isEmployee: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authService
        .getMe()
        .then(setUser)
        .catch(() => {
          // Token geçersiz olabilir, localStorage'ı temizlemeden sadece kullanıcıyı null yap.
          // Token'lar hala duruyor — login sayfasına yönlendirilen kullanıcı
          // yeni giriş yaparsa eski tokenlar üzerine yazılır.
          // NOT: localStorage.clear() yapmıyoruz çünkü refresh token hala
          // geçerli olabilir ve sonraki bir istekte refresh yapılabilir.
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authService.login(email, password);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken') ?? undefined;
    try {
      await authService.logout(refreshToken);
    } finally {
      localStorage.clear();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAdmin: user?.role === 'SUPER_ADMIN',
        isManager: user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN',
        isSuperAdmin: user?.role === 'SUPER_ADMIN',
        isEmployee: user?.role === 'EMPLOYEE',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
