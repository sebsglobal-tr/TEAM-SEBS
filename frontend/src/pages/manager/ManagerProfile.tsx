import { useAuth } from '../../hooks/useAuth';
import { UserCircle } from 'lucide-react';
import { formatDateTime } from '../../utils/format';

export function ManagerProfile() {
  const { user } = useAuth();

  if (!user) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Profil</h1>
        <p className="page-subtitle">Hesap bilgileriniz</p>
      </div>

      <div className="card">
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'rgba(37,99,235,0.15)', color: '#2563eb',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '1.5rem',
          }}>
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{user.firstName} {user.lastName}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{user.email}</div>
            <span className="badge badge-info" style={{ marginTop: '0.35rem' }}>Yönetici</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Hesap Detayları</div></div>
        <div className="card-body">
          <div className="grid-3">
            <div>
              <div className="form-label">Ad</div>
              <div>{user.firstName}</div>
            </div>
            <div>
              <div className="form-label">Soyad</div>
              <div>{user.lastName}</div>
            </div>
            <div>
              <div className="form-label">E-posta</div>
              <div>{user.email}</div>
            </div>
            <div>
              <div className="form-label">Rol</div>
              <span className="badge badge-info">Yönetici</span>
            </div>
            <div>
              <div className="form-label">Departman</div>
              <div>{(user as any).department?.name ?? '-'}</div>
            </div>
            <div>
              <div className="form-label">Pozisyon</div>
              <div>{user.position ?? '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
