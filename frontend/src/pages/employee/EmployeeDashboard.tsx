import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Coffee, Play, Square, FileText, Upload,
  ListTodo, AlertCircle, CheckCircle, AlertTriangle,
  ArrowRight, MessageSquare, User, Calendar,
} from 'lucide-react';
import { workSessionsService } from '../../services/work-sessions.service';
import { filesService, type FileRecord } from '../../services/files.service';
import { tasksService } from '../../services/tasks.service';
import { useWorkSession } from '../../hooks/useWorkSession';
import { formatDuration, formatDate } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import type { Task } from '../../types';

// ─── Helpers ────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'Devam Ediyor',
  BLOCKED: 'Blokaj Var',
  SUBMITTED: 'İncelemede',
  REVISION_REQUESTED: 'Revize İstendi',
  MANAGER_APPROVED: 'Onaylandı',
  ADMIN_APPROVED: 'Admin Onaylı',
};

function isDueSoon(task: Task): boolean {
  if (!task.dueDate) return false;
  if (['MANAGER_APPROVED', 'ADMIN_APPROVED', 'CANCELLED'].includes(task.status)) return false;
  const diff = new Date(task.dueDate).getTime() - Date.now();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (['MANAGER_APPROVED', 'ADMIN_APPROVED', 'CANCELLED'].includes(task.status)) return false;
  return new Date(task.dueDate) < new Date();
}

// ─── Component ──────────────────────────────────────────────────

export function EmployeeDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ws = useWorkSession();
  const [showEndOfDay, setShowEndOfDay] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentFiles, setRecentFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [t, f] = await Promise.all([
        tasksService.getAll({ limit: '50' }),
        filesService.getAll({ limit: 5 }),
      ]);
      setTasks(t);
      setRecentFiles(f);
    } catch (err) {
      console.error('Veri yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Kategorize et (only employee's tasks)
  const myTasks = tasks.filter(t => t.assignedToId === user?.id);
  const todayTasks = myTasks.filter(t => {
    if (!t.dueDate) return false;
    const today = new Date();
    const due = new Date(t.dueDate);
    return due.toDateString() === today.toDateString();
  });
  const revisionTasks = myTasks.filter(t => t.status === 'REVISION_REQUESTED');
  const dueSoonTasks = myTasks.filter(isDueSoon);
  const overdueTasks = myTasks.filter(isOverdue);
  const ongoingTasks = myTasks.filter(t =>
    ['IN_PROGRESS', 'ASSIGNED_TO_EMPLOYEE', 'PENDING', 'PARTIALLY_COMPLETED'].includes(t.status)
  );

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      {/* ─── Başlık + Canlı Sayaç ─── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem',
      }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Merhaba, {user?.firstName} 👋</h1>
          <p className="page-subtitle" style={{ margin: '0.15rem 0 0 0' }}>
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {ws.error && (
          <div style={{
            width: '100%', padding: '0.65rem 0.85rem',
            background: 'rgba(239,68,68,0.1)', borderRadius: 8,
            border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontSize: '0.85rem', color: '#ef4444',
          }}>
            <AlertCircle size={16} /> {ws.error}
          </div>
        )}

        {/* Canlı sayaç */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.5rem 1rem', background: ws.activeSession ? 'rgba(16,185,129,0.1)' : 'var(--bg-primary)',
          borderRadius: 12, border: `1px solid ${ws.activeSession ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
        }}>
          {ws.activeSession ? (
            <>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace', color: '#10b981', letterSpacing: 2 }}>
                  {ws.formatHHMMSS(ws.displaySeconds)}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  {ws.isOnBreak ? 'Molada' : 'Çalışıyor'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexDirection: 'column' }}>
                {!ws.isOnBreak ? (
                  <button className="btn btn-secondary btn-sm" onClick={ws.startBreak} disabled={ws.actionLoading}>
                    <Coffee size={12} /> Mola
                  </button>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={ws.endBreak} disabled={ws.actionLoading}>
                    Moladan Dön
                  </button>
                )}
                <button className="btn btn-danger btn-sm" onClick={ws.stop} disabled={ws.stopLoading}>
                  <Square size={12} /> Bitir
                </button>
              </div>
            </>
          ) : (
            <button className="btn btn-primary" onClick={ws.start} disabled={ws.actionLoading}>
              <Play size={16} /> {ws.actionLoading ? 'Başlatılıyor...' : 'Çalışmayı Başlat'}
            </button>
          )}
        </div>
      </div>

      {/* ─── Özet Kartları ─── */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/tasks')}>
          <div className="stat-card-icon employee" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
            <ListTodo size={20} />
          </div>
          <div>
            <div className="stat-card-label">Devam Eden Görev</div>
            <div className="stat-card-value">{ongoingTasks.length}</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/tasks')}>
          <div className="stat-card-icon employee" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="stat-card-label">Revize İstenen</div>
            <div className="stat-card-value" style={{ color: revisionTasks.length > 0 ? '#ef4444' : undefined }}>
              {revisionTasks.length}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon employee" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <Clock size={20} />
          </div>
          <div>
            <div className="stat-card-label">Bugün Aktif</div>
            <div className="stat-card-value">{formatDuration(ws.session?.totals.active ?? 0)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon employee" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            <Coffee size={20} />
          </div>
          <div>
            <div className="stat-card-label">Mola</div>
            <div className="stat-card-value">{formatDuration(ws.session?.totals.break ?? 0)}</div>
          </div>
        </div>
      </div>

      {/* ─── Uyarılar ─── */}
      {revisionTasks.length > 0 && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem',
          background: 'rgba(239,68,68,0.1)', borderRadius: 8,
          border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          cursor: 'pointer',
        }} onClick={() => navigate('/employee/tasks')}>
          <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', color: '#ef4444', flex: 1 }}>
            <strong>{revisionTasks.length} görevde</strong> revize istenmiş. Gözden geçirmek için tıklayın.
          </span>
          <ArrowRight size={16} style={{ color: '#ef4444' }} />
        </div>
      )}

      {overdueTasks.length > 0 && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem',
          background: 'rgba(245,158,11,0.1)', borderRadius: 8,
          border: '1px solid rgba(245,158,11,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          cursor: 'pointer',
        }} onClick={() => navigate('/employee/tasks')}>
          <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', color: '#f59e0b', flex: 1 }}>
            <strong>{overdueTasks.length} gecikmiş</strong> görev bulunuyor.
          </span>
          <ArrowRight size={16} style={{ color: '#f59e0b' }} />
        </div>
      )}

      {/* ─── Ana İçerik: 2 Kolon ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Sol: Görevler */}
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/tasks')}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={16} /> Bugünkü Görevlerim
              </div>
              <ArrowRight size={14} />
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {todayTasks.length === 0 ? (
                <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
                  Bugün teslim edilmesi gereken görev yok.
                </div>
              ) : (
                todayTasks.slice(0, 5).map(task => (
                  <div key={task.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }} onClick={() => navigate(`/employee/tasks/${task.id}`)}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: task.status === 'IN_PROGRESS' ? '#3b82f6' :
                                  task.status === 'REVISION_REQUESTED' ? '#ef4444' :
                                  task.status === 'SUBMITTED' ? '#f59e0b' : '#d1d5db',
                    }} />
                    <div style={{ flex: 1, fontSize: '0.85rem' }}>{task.title}</div>
                    <span className={`badge ${task.priority === 'URGENT' ? 'badge-danger' : task.priority === 'HIGH' ? 'badge-warning' : 'badge-default'}`} style={{ fontSize: '0.65rem' }}>
                      {task.priority}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/tasks')}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ListTodo size={16} /> Devam Eden Görevlerim
              </div>
              <ArrowRight size={14} />
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {ongoingTasks.length === 0 ? (
                <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
                  Devam eden görev bulunmuyor.
                </div>
              ) : (
                ongoingTasks.slice(0, 5).map(task => (
                  <div key={task.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }} onClick={() => navigate(`/employee/tasks/${task.id}`)}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{task.title}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
                        <span>%{task.completionPercent}</span>
                        {task.dueDate && <span>Son: {formatDate(task.dueDate)}</span>}
                      </div>
                    </div>
                    <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                      {STATUS_LABELS[task.status] ?? task.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {dueSoonTasks.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid #f59e0b' }}>
              <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/tasks')}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f59e0b' }}>
                  <Clock size={16} /> Teslim Tarihi Yaklaşanlar
                </div>
                <ArrowRight size={14} />
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {dueSoonTasks.slice(0, 4).map(task => (
                  <div key={task.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }} onClick={() => navigate(`/employee/tasks/${task.id}`)}>
                    <div style={{ flex: 1, fontSize: '0.85rem' }}>{task.title}</div>
                    <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                      {formatDate(task.dueDate!)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sağ: Süre + Dosyalar + Feedback */}
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/timer')}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={16} /> Bugünkü Çalışma Sürem
              </div>
              <ArrowRight size={14} />
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(16,185,129,0.08)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Aktif</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>
                    {formatDuration(ws.session?.totals.active ?? 0)}
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(245,158,11,0.08)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Mola</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b' }}>
                    {formatDuration(ws.session?.totals.break ?? 0)}
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(99,102,241,0.08)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Başlangıç</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {ws.activeSession ? new Date(ws.activeSession.startedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Durum</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: ws.activeSession ? (ws.isOnBreak ? '#f59e0b' : '#10b981') : '#6b7280' }}>
                    {ws.activeSession ? (ws.isOnBreak ? 'Molada' : 'Çalışıyor') : 'Başlatılmadı'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Gün Sonu Raporu */}
          <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--accent)', cursor: 'pointer' }} onClick={() => navigate('/employee/upload-report')}>
            <div className="card-body" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Upload size={18} style={{ color: 'var(--accent)' }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Gün Sonu Raporu</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {ws.activeSession ? 'Çalışmayı bitirmeden raporunuzu yükleyin' : 'Yeni rapor eklemek için tıklayın'}
                </div>
              </div>
              <ArrowRight size={14} style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }} />
            </div>
          </div>

          {recentFiles.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FileText size={16} /> Son Dosyalarım
                </div>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {recentFiles.slice(0, 4).map(file => (
                  <div key={file.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)',
                  }}>
                    <FileText size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.originalName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/feedbacks')}>
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <MessageSquare size={16} /> Geri Bildirimler
              </div>
              <ArrowRight size={14} />
            </div>
            <div className="card-body" style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Yöneticinizden gelen geri bildirimleri görüntüleyin
            </div>
          </div>
        </div>
      </div>

      {/* ─── Gün Sonu Raporu Modal ─── */}
      {showEndOfDay && (
        <div className="modal-overlay" onClick={() => setShowEndOfDay(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Çalışma Sonlandı 🎯</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEndOfDay(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <CheckCircle size={48} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Bugünkü çalışmanız kaydedildi.<br />
                  Gün sonu raporu eklemek ister misiniz?
                </div>
              </div>
              <div style={{
                background: 'rgba(16,185,129,0.08)', borderRadius: 8,
                padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5,
              }}>
                <strong>Rapor şunları içerebilir:</strong><br />
                · Bugün ne yaptım?<br />
                · Hangi görevi tamamladım?<br />
                · Nerede takıldım?<br />
                · Yarın ne kalıyor?
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowEndOfDay(false)}>
                Daha Sonra
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                setShowEndOfDay(false);
                navigate('/employee/upload-report');
              }}>
                Rapor Ekle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
