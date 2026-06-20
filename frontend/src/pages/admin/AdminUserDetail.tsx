import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Clock, BarChart3, Calendar, List } from 'lucide-react';
import { usersService } from '../../services/users.service';
import { workSessionsService } from '../../services/work-sessions.service';
import { formatDuration, formatDateTime, formatDate } from '../../utils/format';
import type { User, WorkSession } from '../../types';

interface DailyWorkSummary {
  date: string;
  activeSeconds: number;
  idleSeconds: number;
  breakSeconds: number;
  lockedSeconds: number;
  sessionCount: number;
}

function groupByDay(sessions: WorkSession[]): DailyWorkSummary[] {
  const map = new Map<string, DailyWorkSummary>();
  sessions.forEach((s) => {
    const dateKey = new Date(s.startedAt).toISOString().split('T')[0];
    const existing = map.get(dateKey) ?? {
      date: dateKey,
      activeSeconds: 0,
      idleSeconds: 0,
      breakSeconds: 0,
      lockedSeconds: 0,
      sessionCount: 0,
    };
    existing.activeSeconds += s.totalActiveSeconds;
    existing.idleSeconds += s.totalIdleSeconds;
    existing.breakSeconds += s.totalBreakSeconds;
    existing.lockedSeconds += s.totalLockedSeconds;
    existing.sessionCount += 1;
    map.set(dateKey, existing);
  });
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

const SESSION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktif',
  PAUSED: 'Duraklatıldı',
  AUTO_PAUSED: 'Otomatik Duraklatıldı',
  ENDED: 'Tamamlandı',
};

export function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Work sessions state
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'daily' | 'list'>('daily');

  // Load user info
  useEffect(() => {
    if (!id) return;
    usersService
      .getById(id)
      .then(setUser)
      .catch(() => navigate('/admin/employees'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // Load work sessions
  const loadSessions = useCallback(async (start: string, end: string) => {
    if (!id) return;
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const data = await workSessionsService.getByUser(id, start, end);
      setWorkSessions(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Çalışma süreleri yüklenirken bir hata oluştu.';
      setSessionsError(msg);
      setWorkSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [id]);

  // Load sessions on mount and when id changes
  useEffect(() => {
    loadSessions(startDate, endDate);
    // Only run on mount / id change, not when dates change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSearch = () => {
    loadSessions(startDate, endDate);
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;
  if (!user) return <div className="empty-state">Kullanıcı bulunamadı.</div>;

  const dailySummary = groupByDay(workSessions);
  const totalActive = workSessions.reduce((s, ws) => s + ws.totalActiveSeconds, 0);
  const totalBreak = workSessions.reduce((s, ws) => s + ws.totalBreakSeconds, 0);
  const totalIdle = workSessions.reduce((s, ws) => s + ws.totalIdleSeconds, 0);
  const totalLocked = workSessions.reduce((s, ws) => s + ws.totalLockedSeconds, 0);

  return (
    <div>
      <button
        className="btn btn-ghost"
        onClick={() => navigate('/admin/employees')}
        style={{ marginBottom: '1rem' }}
      >
        <ArrowLeft size={16} /> Geri
      </button>

      {/* User Info Header */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="page-title">
            {user.firstName} {user.lastName}
          </h1>
          <p className="page-subtitle">
            {user.email} · {user.position ?? '-'}
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate(`/messages?user=${id}`)}
        >
          <MessageSquare size={14} /> Mesaj Gönder
        </button>
      </div>

      {/* User Info Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">Kullanıcı Bilgileri</div>
        </div>
        <div className="card-body">
          <div className="grid-2">
            <div>
              <div className="form-label">Rol</div>
              <div>{user.role}</div>
            </div>
            <div>
              <div className="form-label">Durum</div>
              <span
                className={`badge ${user.status === 'ACTIVE' ? 'badge-success' : 'badge-default'}`}
              >
                {user.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
              </span>
            </div>
            <div>
              <div className="form-label">Departman</div>
              <div>{user.department?.name ?? '-'}</div>
            </div>
            <div>
              <div className="form-label">Kayıt Tarihi</div>
              <div>{formatDateTime(user.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Work Sessions Section */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} />
            <div>
              <div className="card-title">Çalışma Süreleri</div>
              <div className="card-subtitle">
                Seçilen tarih aralığındaki çalışma kayıtları
              </div>
            </div>
          </div>
          <div className="btn-group" style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              className={`btn btn-sm ${viewMode === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('daily')}
              title="Günlük Görünüm"
            >
              <Calendar size={14} />
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('list')}
              title="Liste Görünümü"
            >
              <List size={14} />
            </button>
          </div>
        </div>

        <div className="card-body">
          {/* Summary Stats */}
          <div className="stats-grid" style={{ marginBottom: '1rem' }}>
            <div className="stat-card" style={{ borderLeft: '3px solid #10b981' }}>
              <div
                className="stat-card-icon"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
              >
                <Clock size={20} />
              </div>
              <div>
                <div className="stat-card-label">Toplam Aktif</div>
                <div className="stat-card-value" style={{ color: '#10b981' }}>
                  {formatDuration(totalActive)}
                </div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid #8b5cf6' }}>
              <div
                className="stat-card-icon"
                style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}
              >
                <Clock size={20} />
              </div>
              <div>
                <div className="stat-card-label">Toplam Mola</div>
                <div className="stat-card-value" style={{ color: '#8b5cf6' }}>
                  {formatDuration(totalBreak)}
                </div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
              <div
                className="stat-card-icon"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
              >
                <BarChart3 size={20} />
              </div>
              <div>
                <div className="stat-card-label">Toplam Boşta</div>
                <div className="stat-card-value" style={{ color: '#f59e0b' }}>
                  {formatDuration(totalIdle)}
                </div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid #3b82f6' }}>
              <div
                className="stat-card-icon"
                style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}
              >
                <List size={20} />
              </div>
              <div>
                <div className="stat-card-label">Oturum Sayısı</div>
                <div className="stat-card-value">{workSessions.length}</div>
              </div>
            </div>
          </div>

          {/* Date Filter */}
          <div
            className="filters-bar"
            style={{ marginBottom: '1rem', padding: 0, background: 'none' }}
          >
            <div>
              <label
                className="form-label"
                style={{ fontSize: '0.75rem', marginBottom: 4 }}
              >
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
              <label
                className="form-label"
                style={{ fontSize: '0.75rem', marginBottom: 4 }}
              >
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
              onClick={handleSearch}
              disabled={sessionsLoading}
              style={{ marginTop: 22 }}
            >
              {sessionsLoading ? 'Yükleniyor...' : 'Getir'}
            </button>
          </div>

          {/* Error State */}
          {sessionsError && (
            <div
              className="empty-state"
              style={{ padding: '1rem', marginBottom: '1rem' }}
            >
              <div className="empty-state-text" style={{ color: '#ef4444' }}>
                {sessionsError}
              </div>
            </div>
          )}

          {/* Loading State */}
          {sessionsLoading && (
            <div className="loading-spinner">Süreler yükleniyor...</div>
          )}

          {/* No Data State */}
          {!sessionsLoading && !sessionsError && workSessions.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Clock size={48} />
              </div>
              <div className="empty-state-text">
                Bu tarih aralığında çalışma kaydı bulunamadı.
              </div>
            </div>
          )}

          {/* Data Views */}
          {!sessionsLoading && workSessions.length > 0 && (
            <>
              {viewMode === 'daily' ? (
                /* Daily Grouped View */
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tarih</th>
                        <th>Aktif Süre</th>
                        <th>Boşta</th>
                        <th>Mola</th>
                        <th>Toplam Süre</th>
                        <th>Oturum Sayısı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySummary.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            Veri bulunamadı.
                          </td>
                        </tr>
                      ) : (
                        dailySummary.map((d) => {
                          const dailyTotal =
                            d.activeSeconds + d.idleSeconds + d.breakSeconds + d.lockedSeconds;
                          return (
                            <tr key={d.date}>
                              <td style={{ fontWeight: 500 }}>{formatDate(d.date)}</td>
                              <td style={{ color: '#10b981', fontWeight: 600 }}>
                                {formatDuration(d.activeSeconds)}
                              </td>
                              <td style={{ color: '#f59e0b' }}>
                                {formatDuration(d.idleSeconds)}
                              </td>
                              <td style={{ color: '#8b5cf6' }}>
                                {formatDuration(d.breakSeconds)}
                              </td>
                              <td style={{ fontWeight: 500 }}>
                                {formatDuration(dailyTotal)}
                              </td>
                              <td>{d.sessionCount}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Session List View */
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Başlangıç</th>
                        <th>Bitiş</th>
                        <th>Aktif</th>
                        <th>Boşta</th>
                        <th>Mola</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workSessions.slice(0, 50).map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontSize: '0.85rem' }}>
                            {formatDateTime(s.startedAt)}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {s.endedAt ? formatDateTime(s.endedAt) : '-'}
                          </td>
                          <td style={{ color: '#10b981', fontWeight: 600 }}>
                            {formatDuration(s.totalActiveSeconds)}
                          </td>
                          <td>{formatDuration(s.totalIdleSeconds)}</td>
                          <td>{formatDuration(s.totalBreakSeconds)}</td>
                          <td>
                            <span
                              className={`badge ${
                                s.status === 'ACTIVE'
                                  ? 'badge-success'
                                  : s.status === 'PAUSED'
                                    ? 'badge-warning'
                                    : 'badge-default'
                              }`}
                            >
                              {SESSION_STATUS_LABELS[s.status] ?? s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
