import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, User, Mail, AlertCircle, CheckCircle, Save, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth.service';
import { usersService } from '../../services/users.service';
import { api } from '../../services/api';

export function EmployeeProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Edit form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');

  // Password form
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    api.get('/reports/stats/my')
      .then((res) => setStats(res.data ?? res))
      .catch((err) => console.error('Rapor istatistikleri yüklenemedi:', err));
  }, []);

  const startEdit = () => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    setPosition(user.position || '');
    setEditing(true);
    setError('');
    setSuccess('');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await usersService.update(user.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        position: position.trim() || undefined,
      } as any);
      // Token'daki bilgileri güncellemek için yeniden giriş yap
      const { data } = await api.get('/auth/me');
      setSuccess('Profil başarıyla güncellendi!');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Güncellenirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setError('Tüm alanları doldurun');
      return;
    }
    if (newPassword.length < 6) {
      setError('Yeni şifre en az 6 karakter olmalıdır');
      return;
    }
    setPasswordSaving(true);
    setError('');
    setSuccess('');
    try {
      await authService.changePassword(currentPassword, newPassword);
      setSuccess('Şifre başarıyla değiştirildi!');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Şifre değiştirilirken hata oluştu');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!user) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Profil</h1>
          <p className="page-subtitle">Hesap bilgileriniz ve istatistikleriniz</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!editing && (
            <button className="btn btn-primary btn-sm" onClick={startEdit}>
              <User size={14} /> Profili Düzenle
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/messages')}>
            <MessageSquare size={14} /> Mesajlar
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-banner alert-error">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="alert-banner alert-success">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'rgba(5,150,105,0.15)', color: '#059669',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '1.5rem',
          }}>
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{user.firstName} {user.lastName}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{user.email}</div>
            <span className="badge badge-success" style={{ marginTop: '0.35rem' }}>Çalışan</span>
          </div>
        </div>
      </div>

      {editing ? (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><User size={16} /> Profili Düzenle</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>İptal</button>
          </div>
          <div className="card-body">
            <form onSubmit={handleSaveProfile}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ad</label>
                  <input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Soyad</label>
                  <input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">E-posta</label>
                <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Pozisyon</label>
                <input className="form-input" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Örn: Yazılım Geliştirici" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={14} /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-header"><div className="card-title">Hesap Detayları</div></div>
            <div className="card-body">
              <div className="grid-3">
                <div><div className="form-label">Ad</div><div>{user.firstName}</div></div>
                <div><div className="form-label">Soyad</div><div>{user.lastName}</div></div>
                <div><div className="form-label">E-posta</div><div>{user.email}</div></div>
                <div><div className="form-label">Rol</div><span className="badge badge-success">Çalışan</span></div>
                <div><div className="form-label">Durum</div>
                  <span className={`badge ${user.status === 'ACTIVE' ? 'badge-success' : 'badge-default'}`}>
                    {user.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <div><div className="form-label">Pozisyon</div><div>{user.position ?? '-'}</div></div>
              </div>
            </div>
          </div>

          {/* Şifre Değiştirme */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header">
              <div className="card-title"><Lock size={16} /> Şifre</div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowPasswordForm(!showPasswordForm)}>
                {showPasswordForm ? 'İptal' : 'Şifre Değiştir'}
              </button>
            </div>
            {showPasswordForm && (
              <div className="card-body">
                <form onSubmit={handleChangePassword}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Mevcut Şifre</label>
                      <input type="password" className="form-input" value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Yeni Şifre</label>
                      <input type="password" className="form-input" value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)} required minLength={6}
                        autoComplete="new-password" placeholder="En az 6 karakter" />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={passwordSaving}>
                    {passwordSaving ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </>
      )}

      {/* Rapor İstatistikleri */}
      {stats && (
        <div className="card">
          <div className="card-header"><div className="card-title">Rapor İstatistikleri</div></div>
          <div className="card-body">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-card-icon employee"><span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.totalReports ?? 0}</span></div>
                <div><div className="stat-card-label">Toplam Rapor</div></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-icon employee" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.pendingReports ?? 0}</span>
                </div>
                <div><div className="stat-card-label">Bekleyen</div></div>
              </div>
              <div className="stat-card">
                <div className="stat-card-icon employee" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.approvedReports ?? 0}</span>
                </div>
                <div><div className="stat-card-label">Onaylanan</div></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
