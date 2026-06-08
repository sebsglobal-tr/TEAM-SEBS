import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';

export function EmployeeProfile() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get('/reports/stats/my').then(setStats).catch(() => {});
  }, []);

  if (!user) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Profil</h1>
        <p className="page-subtitle">Hesap bilgileriniz ve istatistikleriniz</p>
      </div>

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
              <span className="badge badge-success">Çalışan</span>
            </div>
            <div>
              <div className="form-label">Durum</div>
              <span className={`badge ${user.status === 'ACTIVE' ? 'badge-success' : 'badge-default'}`}>
                {user.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
              </span>
            </div>
            <div>
              <div className="form-label">Pozisyon</div>
              <div>{user.position ?? '-'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Rapor İstatistikleri */}
      {stats && (
        <div className="card">
          <div className="card-header"><div className="card-title">Rapor İstatistikleri</div></div>
          <div className="card-body">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-card-icon employee"><span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.totalReports ?? 0}</span></div>
                <div>
                  <div className="stat-card-label">Toplam Rapor</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-icon employee" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}><span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.pendingReports ?? 0}</span></div>
                <div>
                  <div className="stat-card-label">Bekleyen</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-icon employee" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}><span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.approvedReports ?? 0}</span></div>
                <div>
                  <div className="stat-card-label">Onaylanan</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
