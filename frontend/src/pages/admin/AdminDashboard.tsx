import { useEffect, useState, useCallback } from 'react';
import { Users, UserCheck, Coffee, Clock, BarChart3, Activity, FileText, Download, ListTodo, RefreshCw, Play, Square, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { workSessionsService, type DashboardWorkStats } from '../../services/work-sessions.service';
import { filesService, type FileRecord } from '../../services/files.service';
import { tasksService } from '../../services/tasks.service';
import { DailyTaskView } from '../../components/DailyTaskView';
import { useWorkSession } from '../../hooks/useWorkSession';
import { formatDuration, formatDateTime } from '../../utils/format';
import type { Task } from '../../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_CONFIG: Record<string, { label: string; icon: string; className: string }> = {
  ONLINE_ACTIVE: { label: '🟢 Aktif', icon: '🟢', className: 'badge-success' },
  ONLINE_IDLE: { label: '🟡 Boşta', icon: '🟡', className: 'badge-warning' },
  ON_BREAK: { label: '☕ Molada', icon: '☕', className: 'badge-info' },
  SCREEN_LOCKED: { label: '🔒 Kilitli', icon: '🔒', className: 'badge-default' },
  OFFLINE: { label: '⚫ Çevrimdışı', icon: '⚫', className: 'badge-default' },
  WORK_SESSION_ENDED: { label: '⏹️ Oturum Bitti', icon: '⏹️', className: 'badge-default' },
};

const REFRESH_INTERVAL = 15000; // 15 seconds

export function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardWorkStats | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const ws = useWorkSession();

  // İlk yükleme: tüm veriler
  const load = useCallback(async () => {
    try {
      const [statsData, filesData, tasksData] = await Promise.all([
        workSessionsService.getDashboardStats(),
        filesService.getAll({ limit: 8 }),
        tasksService.getAll({ limit: "20" }),
      ]);
      setStats(statsData);
      setRecentFiles(filesData);
      setTasks(tasksData);
    } catch (err) {
      console.error('Dashboard yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh: sadece canlı çalışan durumlarını güncelle (dosyalar/görevler sabit)
  const refreshStats = useCallback(async () => {
    try {
      const statsData = await workSessionsService.getDashboardStats();
      setStats(statsData);
    } catch { /* sessiz */ }
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshStats, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshStats]);

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      await tasksService.updateStatus(taskId, status);
      const updated = await tasksService.getAll({ limit: "20" });
      setTasks(updated);
    } catch (err) {
      console.error('Görev durumu güncellenirken hata:', err);
    }
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  const summary = stats?.summary;

  const now = new Date();
  const lastRefresh = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Sistem genel özet · Canlı çalışan durumları</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <RefreshCw size={14} /> Yenile
        </button>
      </div>

      {/* ⏱ Admin Çalışma Sayacı */}
      <div className="card" style={{ marginBottom: '1rem', borderLeft: `4px solid ${ws.activeSession ? '#7c3aed' : '#64748b'}` }}>
        <div className="card-body" style={{ padding: '0.75rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: 2, color: ws.activeSession ? '#7c3aed' : 'var(--text-secondary)' }}>
                  {ws.formatHHMMSS(ws.displaySeconds)}
                </div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                  {ws.activeSession ? (ws.isOnBreak ? '☕ Molada' : '🟢 Çalışıyor') : '⏹️ Başlatılmadı'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {ws.activeSession ? (
                <>
                  {!ws.isOnBreak ? (
                    <button className="btn btn-secondary btn-sm" onClick={ws.startBreak} disabled={ws.actionLoading}>
                      <Coffee size={14} /> Mola
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={ws.endBreak} disabled={ws.actionLoading}>
                      Moladan Dön
                    </button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={ws.stop} disabled={ws.stopLoading}>
                    <Square size={14} /> Bitir
                  </button>
                </>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={ws.start} disabled={ws.actionLoading}>
                  <Play size={14} /> {ws.actionLoading ? 'Başlatılıyor...' : 'Çalışmayı Başlat'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {ws.error && (
        <div style={{
          padding: '0.5rem 0.75rem', marginBottom: '0.75rem',
          background: 'rgba(239,68,68,0.1)', borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          fontSize: '0.82rem', color: '#ef4444',
        }}>
          <Activity size={14} /> {ws.error}
        </div>
      )}

      {/* Canlı Durum Özet Kartları */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card" style={{ borderLeft: '3px solid #7c3aed' }}>
          <div className="stat-card-icon admin"><Users size={20} /></div>
          <div>
            <div className="stat-card-label">Toplam Çalışan</div>
            <div className="stat-card-value">{summary?.totalEmployees ?? 0}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #10b981' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}><Activity size={20} /></div>
          <div>
            <div className="stat-card-label">🟢 Şu An Çalışıyor</div>
            <div className="stat-card-value" style={{ color: '#10b981' }}>{summary?.onlineActive ?? 0}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}><Clock size={20} /></div>
          <div>
            <div className="stat-card-label">🟡 Boşta</div>
            <div className="stat-card-value" style={{ color: '#f59e0b' }}>{summary?.onlineIdle ?? 0}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #8b5cf6' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}><Coffee size={20} /></div>
          <div>
            <div className="stat-card-label">☕ Molada</div>
            <div className="stat-card-value" style={{ color: '#8b5cf6' }}>{summary?.onBreak ?? 0}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #64748b' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(100,116,139,0.15)', color: '#64748b' }}><UserCheck size={20} /></div>
          <div>
            <div className="stat-card-label">🔘 Kapalı</div>
            <div className="stat-card-value">{summary?.offline ?? 0}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #3b82f6' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}><BarChart3 size={20} /></div>
          <div>
            <div className="stat-card-label">Bugün Ekip Toplam</div>
            <div className="stat-card-value">{formatDuration(summary?.totalActiveSecondsToday ?? 0)}</div>
          </div>
        </div>
      </div>

      {/* Çalışan Durum Tablosu - CANLI */}
      <div className="card" style={{ marginBottom: '1.5rem', border: stats?.employees?.some(e => e.currentStatus === 'ONLINE_ACTIVE') ? '1px solid rgba(16,185,129,0.3)' : undefined }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
            <div>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Activity size={16} /> Canlı Çalışan Durumları
              </div>
              <div className="card-subtitle">Son güncelleme: {lastRefresh} · Her 15 saniyede otomatik yenilenir</div>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              Çalışıyor: {summary?.onlineActive ?? 0}
            </span>
            <span style={{ margin: '0 0.35rem' }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
              Boşta: {summary?.onlineIdle ?? 0}
            </span>
            <span style={{ margin: '0 0.35rem' }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6' }} />
              Molada: {summary?.onBreak ?? 0}
            </span>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Çalışan</th>
                <th>Departman</th>
                <th>Anlık Durum</th>
                <th>Oturum</th>
                <th>Bugün Aktif</th>
                <th>Mola</th>
                <th>Bekleyen Görev</th>
              </tr>
            </thead>
            <tbody>
              {(!stats?.employees || stats.employees.length === 0) ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Henüz çalışan bulunmuyor.</td></tr>
              ) : (
                stats.employees.map((emp) => {
                  const statusConf = STATUS_CONFIG[emp.currentStatus] ?? { label: emp.currentStatus, icon: '⚫', className: 'badge-default' };
                  return (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: emp.currentStatus === 'ONLINE_ACTIVE' ? '#10b981' :
                                      emp.currentStatus === 'ONLINE_IDLE' ? '#f59e0b' :
                                      emp.currentStatus === 'ON_BREAK' ? '#8b5cf6' :
                                      emp.currentStatus === 'SCREEN_LOCKED' ? '#3b82f6' : '#d1d5db',
                          animation: emp.currentStatus === 'ONLINE_ACTIVE' ? 'pulse 2s infinite' : 'none',
                        }} />
                        {emp.firstName} {emp.lastName}
                      </td>
                      <td>{emp.department?.name ?? '-'}</td>
                      <td>
                        <span className={`badge ${statusConf.className}`} style={{ fontWeight: 600 }}>
                          {statusConf.label}
                        </span>
                      </td>
                      <td>
                        {emp.hasActiveSession ? (
                          <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Aktif</span>
                        ) : (
                          <span className="badge badge-default" style={{ fontSize: '0.65rem' }}>Kapalı</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: emp.todayActiveSeconds > 0 ? '#10b981' : undefined }}>
                        {formatDuration(emp.todayActiveSeconds)}
                      </td>
                      <td>{formatDuration(emp.todayBreakSeconds)}</td>
                      <td>
                        <span className={`badge ${emp.pendingTasks > 0 ? 'badge-warning' : 'badge-default'}`}>
                          {emp.pendingTasks}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Günlük Görev Takvimi */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ListTodo size={18} /> Günlük Görev Takvimi
            </div>
            <div className="card-subtitle">Sistemdeki tüm görevlerin akış görünümü</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/tasks')}>
            Tüm Görevler
          </button>
        </div>
        <div className="card-body" style={{ paddingTop: '0.5rem' }}>
          <DailyTaskView
            tasks={tasks}
            onStatusChange={handleStatusChange}
            onViewDetail={(id) => navigate(`/admin/tasks/${id}`)}
          />
        </div>
      </div>

      {/* Son Dosyalar */}
      {recentFiles.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Son Yüklenen Dosyalar</div>
              <div className="card-subtitle">Sisteme yüklenen son dosyalar</div>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Dosya</th>
                  <th>Yükleyen</th>
                  <th>Boyut</th>
                  <th>Tarih</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {recentFiles.map((file) => (
                  <tr key={file.id}>
                    <td><FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />{file.originalName}</td>
                    <td>{file.uploadedBy ? `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}` : '-'}</td>
                    <td>{formatFileSize(file.size)}</td>
                    <td>{formatDateTime(file.createdAt)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => filesService.download(file.id, file.originalName)}>
                        <Download size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
