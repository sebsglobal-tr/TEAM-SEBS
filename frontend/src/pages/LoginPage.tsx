import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { LogIn, Shield, Eye, EyeOff } from 'lucide-react';
import './login.css';

const HOME_BY_ROLE: Record<string, string> = {
  SUPER_ADMIN: '/admin/dashboard',
  MANAGER: '/manager/dashboard',
  EMPLOYEE: '/employee/dashboard',
};

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  // Already logged in → redirect in useEffect, not during render
  useEffect(() => {
    if (user) {
      const target = HOME_BY_ROLE[user.role] ?? '/dashboard';
      navigate(target, { replace: true });
    }
  }, [user, navigate]);

  // Don't render login form if already authenticated
  if (user) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      const target = HOME_BY_ROLE[loggedInUser?.role] ?? '/dashboard';
      navigate(target, { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-shapes">
        <div className="shape shape-1" />
        <div className="shape shape-2" />
        <div className="shape shape-3" />
      </div>

      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo-icon">
            <Shield size={28} />
          </div>
          <h1>Sebs Panel</h1>
          <p>Şeffaf çalışan takip ve görev yönetim sistemi</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">E-posta Adresi</label>
            <div className="input-wrapper">
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@sirket.com"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Şifre</label>
            <div className="input-wrapper password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button type="submit" loading={loading} className="login-btn">
            <LogIn size={16} />
            Giriş Yap
          </Button>
        </form>

        <div className="login-footer">
          <p>© {new Date().getFullYear()} Sebs Global. Tüm hakları saklıdır.</p>
        </div>
      </div>
    </div>
  );
}
