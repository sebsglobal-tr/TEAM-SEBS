import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Clock, BarChart3, Activity, Coffee, UserCheck, ListTodo,
  Play, Square, RefreshCw, MessageSquare, Send,
} from 'lucide-react';
import { workSessionsService, type DashboardWorkStats } from '../../services/work-sessions.service';
import { tasksService } from '../../services/tasks.service';
import { messagesService } from '../../services/messages.service';
import { DailyTaskView } from '../../components/DailyTaskView';
import { formatDuration } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import { useWorkSessionHeartbeat } from '../../hooks/useWorkSessionHeartbeat';
import type { Task, WorkSessionToday } from '../../types';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ONLINE_ACTIVE: { label: '🟢 Aktif', className: 'badge-success' },
  ONLINE_IDLE: { label: '🟡 Boşta', className: 'badge-warning' },
  ON_BREAK: { label: '☕ Molada', className: 'badge-info' },
  SCREEN_LOCKED: { label: '🔒 Kilitli', className: 'badge-default' },
  OFFLINE: { label: '⚫ Çevrimdışı', className: 'badge-default' },
  WORK_SESSION_ENDED: { label: '⏹️ Bitti', className: 'badge-default' },
};

const REFRESH_INTERVAL = 15000;

export function ManagerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardWorkStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<WorkSessionToday | null>(null);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const displayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Timer hesaplama: totalActiveSeconds + (now - lastResumedAt ?? startedAt)
   * setInterval SADECE ekranı günceller, süreyi hesaplamaz.
   */
  const calculateActiveSeconds = useCallback((sessionData: WorkSessionToday | null): number => {
    const active = sessionData?.activeSession;
    if (!active) return 0;
    if (active.status === 'ACTIVE') {
      const refTime = active.lastResumedAt
        ? new Date(active.lastResumedAt).getTime()
        : new Date(active.startedAt).getTime();
      return active.totalActiveSeconds + Math.max(0, Math.floor((Date.now() - refTime) / 1000));
    }
    return active.totalActiveSeconds;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [statsData, tasksData, sessionData, msgUnread] = await Promise.all([
        workSessionsService.getDashboardStats(),
        tasksService.getAll({ limit: "20" }),
        workSessionsService.getToday(),
        messagesService.getUnreadCount().catch(() => 0),
      ]);
      setStats(statsData);
      setTasks(tasksData);
      setSession(sessionData);
      setDisplaySeconds(calculateActiveSeconds(sessionData));
      setUnreadMessages(msgUnread);
    } catch (err) {
      console.error('Dashboard yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadData]);

  // Real-time timer — Date.now() tabanlı, setInterval sadece görüntü günceller
  const activeSession = session?.activeSession;
  const isActive = !!activeSession && activeSession.status === 'ACTIVE';
  const isPaused = activeSession?.status === 'PAUSED';

  useEffect(() => {
    if (!isActive) {
      if (displayRef.current) { clearInterval(displayRef.current); displayRef.current = null; }
      return;
    }

    displayRef.current = setInterval(() => {
      setDisplaySeconds((prev) => {
        if (session?.activeSession?.status === 'ACTIVE') {
          return calculateActiveSeconds(session);
        }
        return prev;
      });
    }, 1000);

    return () => { if (displayRef.current) clearInterval(displayRef.current); };
  }, [isActive, session, calculateActiveSeconds]);

  useWorkSessionHeartbeat({
    isSessionActive: isActive,
    onUpdate: loadData,
  });

  const handleAction = async (action: () => Promise<unknown>, onSuccess?: () => void) => {
    setActionLoading(true);
    try { await action(); onSuccess?.(); loadData(); } finally { setActionLoading(false); }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try { await workSessionsService.resume(); loadData(); } catch {} finally { setActionLoading(false); }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try { await workSessionsService.pause(); loadData(); } finally { setActionLoading(false); }
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      await tasksService.updateStatus(taskId, status);
      const updated = await tasksService.getAll({ limit: "20" });
      setTasks(updated);
    } catch (err) {
      console.error('Görev durumu güncellenirken hata:', err);
    }
  };

  const formatHHMMSS = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  const summary = stats?.summary;
  const lastRefresh = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div>
      {/* Header with Timer + Actions */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">Yönetici Dashboard</h1>
          <p className="page-subtitle">Ekibinizin anlık durumu ve görev takvimi</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/messages')} style={{ position: 'relative' }}>
            <MessageSquare size={14} /> Mesajlar
            {unreadMessages > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: '#ef4444', color: 'white', fontSize: '0.6rem',
                fontWeight: 700, width: 16, height: 16,
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{unreadMessages > 9 ? '9+' : unreadMessages}</span>
            )}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={loadData}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ⏱ Inline Timer Card */}
      <div className="card" style={{ marginBottom: '1rem', borderLeft: `4px solid ${activeSession ? '#10b981' : '#64748b'}` }}>
        <div className="card-body" style={{ padding: '0.85rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: 2, color: activeSession ? (isOnBreak ? '#f59e0b' : '#10b981') : (isPaused ? '#f59e0b' : 'var(--text-secondary)') }}>
                  {formatHHMMSS(displaySeconds)}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  {activeSession ? (isOnBreak ? '☕ Molada' : '🟢 Çalışıyor') : (isPaused ? '⏸️ Duraklatıldı' : '⏹️ Başlatılmadı')}
                </div>
              </div>
              {session && (
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Aktif:</span> <strong style={{ color: '#10b981' }}>{formatDuration(session.totals.active)}</strong></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Mola:</span> {formatDuration(session.totals.break)}</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {!activeSession || isPaused ? (
                !activeSession ? (
                  <button className="btn btn-primary btn-sm" onClick={() => handleAction(() => workSessionsService.start())} disabled={actionLoading}>
                    <Play size={14} /> Çalışmayı Başlat
                  </button>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={handleResume} disabled={actionLoading}>
                    <Play size={14} /> Devam Et
                  </button>
                )
              ) : (
                <>
                  {!isOnBreak ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => handleAction(() => workSessionsService.startBreak(), () => setIsOnBreak(true))} disabled={actionLoading}>
                      <Coffee size={14} /> Mola
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={() => handleAction(() => workSessionsService.endBreak(), () => setIsOnBreak(false))} disabled={actionLoading}>
                      Moladan Dön
                    </button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => handleAction(() => workSessionsService.stop(), () => { setIsOnBreak(false); setDisplaySeconds(0); })} disabled={actionLoading}>
                    <Square size={14} /> Bitir
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Özet Kartları */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card" style={{ borderLeft: '3px solid #2563eb' }}>
          <div className="stat-card-icon manager"><Users size={20} /></div>
          <div>
            <div className="stat-card-label">Ekibim</div>
            <div className="stat-card-value">{summary?.totalEmployees ?? 0}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #10b981' }}>
          <div className="stat-card-icon manager" style={{ color: '#10b981', background: 'rgba(16,185,129,0.15)' }}><Activity size={20} /></div>
          <div>
            <div className="stat-card-label">🟢 Çalışıyor</div>
            <div className="stat-card-value" style={{ color: '#10b981' }}>{summary?.onlineActive ?? 0}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="stat-card-icon manager" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.15)' }}><Clock size={20} /></div>
          <div>
            <div className="stat-card-label">🟡 Boşta</div>
            <div className="stat-card-value" style={{ color: '#f59e0b' }}>{summary?.onlineIdle ?? 0}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #8b5cf6' }}>
          <div className="stat-card-icon manager" style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.15)' }}><Coffee size={20} /></div>
          <div>
            <div className="stat-card-label">☕ Molada</div>
            <div className="stat-card-value" style={{ color: '#8b5cf6' }}>{summary?.onBreak ?? 0}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #64748b' }}>
          <div className="stat-card-icon manager" style={{ color: '#64748b', background: 'rgba(100,116,139,0.15)' }}><BarChart3 size={20} /></div>
          <div>
            <div className="stat-card-label">Bugün Ekip</div>
            <div className="stat-card-value">{formatDuration(summary?.totalActiveSecondsToday ?? 0)}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #7c3aed', cursor: 'pointer' }} onClick={() => navigate('/messages')}>
          <div className="stat-card-icon manager" style={{ color: '#7c3aed', background: 'rgba(124,58,237,0.15)' }}><MessageSquare size={20} /></div>
          <div>
            <div className="stat-card-label">Okunmamış Mesaj</div>
            <div className="stat-card-value" style={{ color: unreadMessages > 0 ? '#ef4444' : undefined }}>{unreadMessages}</div>
          </div>
        </div>
      </div>

      {/* Hızlı İşlemler */}
      <div className="action-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="action-btn" onClick={() => navigate('/manager/employees')}>
          <div className="action-btn-icon" style={{ background: 'rgba(37,99,235,0.12)', color: '#2563eb' }}><Users size={22} /></div>
          <span className="action-btn-label">Ekibim</span>
        </div>
        <div className="action-btn" onClick={() => navigate('/manager/timer')}>
          <div className="action-btn-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}><Clock size={22} /></div>
          <span className="action-btn-label">Sayaç</span>
        </div>
        <div className="action-btn" onClick={() => navigate('/manager/reports')}>
          <div className="action-btn-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}><BarChart3 size={22} /></div>
          <span className="action-btn-label">Raporlar</span>
        </div>
        <div className="action-btn" onClick={() => navigate('/messages')}>
          <div className="action-btn-icon" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}><MessageSquare size={22} /></div>
          <span className="action-btn-label">Mesajlar</span>
        </div>
      </div>

      {/* Ekip Durum Tablosu */}
      {stats?.employees && stats.employees.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', border: stats.employees.some(e => e.currentStatus === 'ONLINE_ACTIVE') ? '1px solid rgba(16,185,129,0.3)' : undefined }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Activity size={16} /> Canlı Ekip Durumu
                </div>
                <div className="card-subtitle">Son güncelleme: {lastRefresh} · Her 15sn yenilenir</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              <span>🟢 {summary?.onlineActive ?? 0}</span>
              <span>🟡 {summary?.onlineIdle ?? 0}</span>
              <span>☕ {summary?.onBreak ?? 0}</span>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Çalışan</th>
                  <th>Durum</th>
                  <th>Oturum</th>
                  <th>Bugün Aktif</th>
                  <th>Mola</th>
                  <th>Görev</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats.employees.map((emp) => {
                  const statusConf = STATUS_CONFIG[emp.currentStatus] ?? { label: emp.currentStatus, className: 'badge-default' };
                  return (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: emp.currentStatus === 'ONLINE_ACTIVE' ? '#10b981' :
                                      emp.currentStatus === 'ONLINE_IDLE' ? '#f59e0b' :
                                      emp.currentStatus === 'ON_BREAK' ? '#8b5cf6' : '#d1d5db',
                          animation: emp.currentStatus === 'ONLINE_ACTIVE' ? 'pulse 2s infinite' : 'none',
                        }} />
                        {emp.firstName} {emp.lastName}
                      </td>
                      <td><span className={`badge ${statusConf.className}`}>{statusConf.label}</span></td>
                      <td>
                        {emp.hasActiveSession
                          ? <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Aktif</span>
                          : <span className="badge badge-default" style={{ fontSize: '0.65rem' }}>Kapalı</span>
                        }
                      </td>
                      <td style={{ fontWeight: 600, color: '#10b981' }}>{formatDuration(emp.todayActiveSeconds)}</td>
                      <td>{formatDuration(emp.todayBreakSeconds)}</td>
                      <td><span className={`badge ${emp.pendingTasks > 0 ? 'badge-warning' : 'badge-default'}`}>{emp.pendingTasks}</span></td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/messages?user=${emp.id}`)} title="Mesaj gönder">
                          <Send size={12} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/manager/employees/${emp.id}`); }}>
                          Detay
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Günlük Görev Takvimi */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ListTodo size={18} /> Günlük Görev Takvimi
            </div>
            <div className="card-subtitle">Ekibinizdeki görevlerin akış görünümü</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/manager/employees')}>
            Tüm Görevler
          </button>
        </div>
        <div className="card-body" style={{ paddingTop: '0.5rem' }}>
          <DailyTaskView
            tasks={tasks}
            onStatusChange={handleStatusChange}
            onViewDetail={(id) => navigate(`/manager/tasks/${id}`)}
          />
        </div>
      </div>
    </div>
  );
}
