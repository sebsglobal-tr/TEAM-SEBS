import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { workSessionsService } from '../../services/work-sessions.service';
import { formatDuration } from '../../utils/format';

interface WorkSessionReport {
  userId: string;
  userName: string;
  totalActive: number;
  totalIdle: number;
  totalBreak: number;
  totalLocked: number;
  sessionCount: number;
}

export function AdminWorkSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<WorkSessionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const load = async (start: string, end: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await workSessionsService.getReports(start, end);
      setSessions(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Çalışma süreleri yüklenirken bir hata oluştu.';
      setError(msg);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Çalışma Süreleri</h1>
        <p className="page-subtitle">
          Tüm çalışanların çalışma süreleri · Detay için çalışan adına tıklayın
        </p>
      </div>

      <div className="filters-bar">
        <div>
          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>
            Başlangıç
          </label>
          <input
            type="date"
            className="form-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>
            Bitiş
          </label>
          <input
            type="date"
            className="form-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={() => load(startDate, endDate)}
          disabled={loading}
          style={{ marginTop: 22 }}
        >
          {loading ? 'Yükleniyor...' : 'Getir'}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div
          className="empty-state"
          style={{ padding: '1.5rem' }}
        >
          <div className="empty-state-icon">
            <span style={{ fontSize: '2rem' }}>⚠️</span>
          </div>
          <div className="empty-state-text" style={{ color: '#ef4444' }}>
            {error}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => load(startDate, endDate)}
            style={{ marginTop: '0.5rem' }}
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* No Data State */}
      {!error && sessions.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Clock size={48} />
          </div>
          <div className="empty-state-text">
            Bu tarih aralığında veri bulunamadı.
          </div>
        </div>
      )}

      {/* Data Table */}
      {!error && sessions.length > 0 && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Çalışan</th>
                <th>Toplam Aktif</th>
                <th>Boşta</th>
                <th>Mola</th>
                <th>Toplam Süre</th>
                <th>Oturum Sayısı</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const total =
                  s.totalActive + s.totalIdle + s.totalBreak + s.totalLocked;
                return (
                  <tr
                    key={s.userId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/admin/users/${s.userId}`)}
                  >
                    <td style={{ fontWeight: 500 }}>{s.userName}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>
                      {formatDuration(s.totalActive)}
                    </td>
                    <td style={{ color: '#f59e0b' }}>
                      {formatDuration(s.totalIdle)}
                    </td>
                    <td style={{ color: '#8b5cf6' }}>
                      {formatDuration(s.totalBreak)}
                    </td>
                    <td>{formatDuration(total)}</td>
                    <td>{s.sessionCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
