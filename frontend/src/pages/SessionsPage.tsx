import { useEffect, useState } from 'react';
import { Shield, LogOut, XCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { authService } from '../services/auth.service';
import { formatDateTime } from '../utils/format';

export function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const data = await authService.getSessions();
      setSessions(data);
    } catch (err) {
      console.error('Oturumlar yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id: string) => {
    if (!confirm('Bu oturumu sonlandırmak istediğinize emin misiniz?')) return;
    try {
      await authService.revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setSuccess('Oturum sonlandırıldı');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Hata oluştu');
      setTimeout(() => setError(''), 3000);
    }
  };

  const revokeAll = async () => {
    if (!confirm('Bu oturum hariç diğer tüm oturumları sonlandırmak istediğinize emin misiniz?')) return;
    try {
      const refreshToken = localStorage.getItem('refreshToken') ?? undefined;
      await authService.revokeAllSessions(refreshToken);
      setSuccess('Diğer tüm oturumlar sonlandırıldı');
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Hata oluştu');
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Oturum Yönetimi</h1>
        <p className="page-subtitle">Aktif oturumlarınızı görüntüleyin ve yönetin</p>
      </div>

      {error && (
        <div className="alert-banner alert-error"><AlertCircle size={16} /> {error}</div>
      )}
      {success && (
        <div className="alert-banner alert-success"><CheckCircle size={16} /> {success}</div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <div className="card-title"><Shield size={16} /> Aktif Oturumlar ({sessions.length})</div>
          {sessions.length > 1 && (
            <button className="btn btn-danger btn-sm" onClick={revokeAll}>
              <LogOut size={14} /> Diğerlerini Sonlandır
            </button>
          )}
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Oturum ID</th>
                <th>Oluşturulma</th>
                <th>Geçerlilik</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Aktif oturum bulunamadı.
                </td></tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{s.id.slice(0, 8)}...</td>
                    <td>{formatDateTime(s.createdAt)}</td>
                    <td>{formatDateTime(s.expiresAt)}</td>
                    <td>
                      <span className={`badge ${s.isExpired ? 'badge-default' : 'badge-success'}`}>
                        {s.isExpired ? 'Süresi Dolmuş' : 'Aktif'}
                      </span>
                    </td>
                    <td>
                      {!s.isExpired && (
                        <button className="btn btn-ghost btn-sm" onClick={() => revoke(s.id)}>
                          <XCircle size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
