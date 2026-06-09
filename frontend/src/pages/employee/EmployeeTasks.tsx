import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksService } from '../../services/tasks.service';
import { useAuth } from '../../hooks/useAuth';
import { formatDate, formatDateTime } from '../../utils/format';
import {
  AlertCircle, CheckCircle, Clock, ArrowRight,
  FileText, Send, AlertTriangle, Eye, Calendar,
  User, Flag, ListTodo,
} from 'lucide-react';
import type { Task } from '../../types';

// ─── Helpers ────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  POOL: 'Havuzda',
  ASSIGNED_TO_MANAGER: 'Yöneticiye Atandı',
  ASSIGNED_TO_EMPLOYEE: 'Atandı',
  PENDING: 'Beklemede',
  IN_PROGRESS: 'Devam Ediyor',
  PARTIALLY_COMPLETED: 'Kısmen Tamamlandı',
  BLOCKED: 'Blokaj Var',
  SUBMITTED: 'İncelemede',
  REVISION_REQUESTED: 'Revize İstendi',
  MANAGER_APPROVED: 'Onaylandı',
  ADMIN_APPROVED: 'Admin Onaylı',
  CANCELLED: 'İptal',
};

const STATUS_BADGE: Record<string, string> = {
  IN_PROGRESS: 'badge-info',
  BLOCKED: 'badge-danger',
  SUBMITTED: 'badge-warning',
  REVISION_REQUESTED: 'badge-danger',
  MANAGER_APPROVED: 'badge-success',
  ADMIN_APPROVED: 'badge-success',
  CANCELLED: 'badge-default',
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: '#ef4444',
  HIGH: '#f59e0b',
  MEDIUM: '#3b82f6',
  LOW: '#6b7280',
};

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (['MANAGER_APPROVED', 'ADMIN_APPROVED', 'CANCELLED'].includes(task.status)) return false;
  return new Date(task.dueDate) < new Date();
}

function isDueSoon(task: Task): boolean {
  if (!task.dueDate) return false;
  if (isOverdue(task)) return false;
  const diff = new Date(task.dueDate).getTime() - Date.now();
  return diff > 0 && diff < 24 * 60 * 60 * 1000; // 24h içinde
}

// ─── Task Card ─────────────────────────────────────────────────

function TaskCard({ task, onStatusUpdate, onView }: {
  task: Task;
  onStatusUpdate: (id: string, status: string) => void;
  onView: (id: string) => void;
}) {
  const [statusLoading, setStatusLoading] = useState(false);

  const handleStatusUpdate = async (status: string) => {
    setStatusLoading(true);
    try {
      await tasksService.updateStatus(task.id, status);
      onStatusUpdate(task.id, status);
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        cursor: 'pointer',
        borderLeft: `3px solid ${PRIORITY_COLORS[task.priority] ?? '#6b7280'}`,
        transition: 'all 0.15s ease',
      }}
      onClick={() => onView(task.id)}
    >
      <div className="card-body" style={{ padding: '1rem' }}>
        {/* Üst satır: durum + öncelik */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className={`badge ${STATUS_BADGE[task.status] ?? 'badge-default'}`}>
              {STATUS_LABELS[task.status] ?? task.status}
            </span>
            <span className="badge badge-default" style={{ background: `${PRIORITY_COLORS[task.priority]}20`, color: PRIORITY_COLORS[task.priority] }}>
              {task.priority}
            </span>
            {task.taskType && (
              <span className="badge badge-default" style={{ fontSize: '0.7rem' }}>
                {task.taskType}
              </span>
            )}
          </div>

          {/* Süre gösterimi */}
          {task.estimatedMinutes && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              <Clock size={12} style={{ display: 'inline', marginRight: 3 }} />
              ~{Math.round(task.estimatedMinutes / 60)}s
            </div>
          )}
        </div>

        {/* Başlık */}
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
          {task.title}
          {isOverdue(task) && (
            <AlertTriangle size={14} style={{ color: '#ef4444', display: 'inline', marginLeft: 6, verticalAlign: 'middle' }} title="Gecikmiş" />
          )}
        </h3>

        {/* Açıklama */}
        {task.description && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: 1.4 }}>
            {task.description.length > 120 ? `${task.description.slice(0, 120)}...` : task.description}
          </p>
        )}

        {/* Beklenen çıktı */}
        {task.expectedOutput && (
          <div style={{
            fontSize: '0.75rem', padding: '0.4rem 0.5rem', marginBottom: '0.5rem',
            background: 'rgba(5,150,105,0.08)', borderRadius: 6,
            borderLeft: '2px solid #10b981',
          }}>
            <span style={{ fontWeight: 600, color: '#10b981' }}>Beklenen Çıktı:</span>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>{task.expectedOutput}</span>
          </div>
        )}

        {/* Meta bilgiler */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          {task.createdBy && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <User size={12} />
              {task.createdBy.firstName} {task.createdBy.lastName}
            </span>
          )}
          {task.dueDate && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 3,
              color: isOverdue(task) ? '#ef4444' : isDueSoon(task) ? '#f59e0b' : undefined,
              fontWeight: isOverdue(task) || isDueSoon(task) ? 600 : 400,
            }}>
              <Calendar size={12} />
              {formatDate(task.dueDate)}
              {isOverdue(task) && ' (Gecikti!)'}
            </span>
          )}
          {task.completionPercent > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              %{task.completionPercent} tamamlandı
            </span>
          )}
        </div>

        {/* İlerleme barı */}
        {task.completionPercent > 0 && task.completionPercent < 100 && (
          <div style={{
            height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: '0.5rem',
          }}>
            <div style={{
              height: '100%', width: `${task.completionPercent}%`,
              background: task.completionPercent > 60 ? '#10b981' : '#f59e0b',
              borderRadius: 2, transition: 'width 0.3s ease',
            }} />
          </div>
        )}

        {/* Alt bilgi: alt görev + dosya + yorum sayısı */}
        {task._count && (
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            {task._count.subTasks > 0 && <span>{task._count.subTasks} alt görev</span>}
            {task._count.files > 0 && <span>{task._count.files} dosya</span>}
            {task._count.comments > 0 && <span>{task._count.comments} yorum</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ana Sayfa ──────────────────────────────────────────────────

export function EmployeeTasks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const loadTasks = useCallback(async () => {
    try {
      const tasks = await tasksService.getAll({ limit: '100' });
      setAllTasks(tasks);
    } catch (err) {
      console.error('Görevler yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Sadece employee'ye atanmış görevler
  const myTasks = allTasks.filter(t => t.assignedToId === user?.id);

  // Kategorize et
  const revisionTasks = myTasks.filter(t => t.status === 'REVISION_REQUESTED');
  const overdueTasks = myTasks.filter(isOverdue);
  const dueSoonTasks = myTasks.filter(isDueSoon);
  const ongoingTasks = myTasks.filter(t =>
    ['IN_PROGRESS', 'ASSIGNED_TO_EMPLOYEE', 'PENDING', 'PARTIALLY_COMPLETED'].includes(t.status)
  );
  const blockedTasks = myTasks.filter(t => t.status === 'BLOCKED');
  const submittedTasks = myTasks.filter(t => t.status === 'SUBMITTED');
  const completedTasks = myTasks.filter(t =>
    ['MANAGER_APPROVED', 'ADMIN_APPROVED', 'CANCELLED'].includes(t.status)
  );

  let filteredTasks = myTasks;
  switch (activeFilter) {
    case 'revision': filteredTasks = revisionTasks; break;
    case 'overdue': filteredTasks = overdueTasks; break;
    case 'due-soon': filteredTasks = dueSoonTasks; break;
    case 'ongoing': filteredTasks = ongoingTasks; break;
    case 'blocked': filteredTasks = blockedTasks; break;
    case 'submitted': filteredTasks = submittedTasks; break;
    case 'completed': filteredTasks = completedTasks; break;
    default: filteredTasks = myTasks; break;
  }

  const handleStatusUpdate = (taskId: string, _status: string) => {
    loadTasks();
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      {/* Başlık */}
      <div className="page-header">
        <h1 className="page-title">Görevlerim</h1>
        <p className="page-subtitle">Size atanan tüm görevler ({myTasks.length})</p>
      </div>

      {/* Hızlı istatistik kartları */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveFilter('ongoing')}>
          <div className="stat-card-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
            <ListTodo size={18} />
          </div>
          <div>
            <div className="stat-card-label">Devam Eden</div>
            <div className="stat-card-value">{ongoingTasks.length}</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveFilter('revision')}>
          <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <AlertCircle size={18} />
          </div>
          <div>
            <div className="stat-card-label">Revize İstenen</div>
            <div className="stat-card-value" style={{ color: revisionTasks.length > 0 ? '#ef4444' : undefined }}>
              {revisionTasks.length}
            </div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveFilter('due-soon')}>
          <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            <Clock size={18} />
          </div>
          <div>
            <div className="stat-card-label">Teslim Yaklaşan</div>
            <div className="stat-card-value">{dueSoonTasks.length}</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/timer')}>
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <Clock size={18} />
          </div>
          <div>
            <div className="stat-card-label">Çalışma Sayacı</div>
            <div className="stat-card-value" style={{ fontSize: '0.85rem' }}>Başlat</div>
          </div>
        </div>
      </div>

      {/* Uyarılar */}
      {revisionTasks.length > 0 && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem',
          background: 'rgba(239,68,68,0.1)', borderRadius: 8,
          border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', color: '#ef4444' }}>
            <strong>{revisionTasks.length} görevde</strong> revize istenmiş. Lütfen gözden geçirin.
          </span>
        </div>
      )}

      {overdueTasks.length > 0 && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem',
          background: 'rgba(245,158,11,0.1)', borderRadius: 8,
          border: '1px solid rgba(245,158,11,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', color: '#f59e0b' }}>
            <strong>{overdueTasks.length} gecikmiş</strong> görev bulunuyor.
          </span>
        </div>
      )}

      {/* Filtreler */}
      <div style={{
        display: 'flex', gap: '0.4rem', marginBottom: '1rem',
        overflowX: 'auto', paddingBottom: 4, flexWrap: 'wrap',
      }}>
        {[
          { key: 'all', label: 'Tümü' },
          { key: 'ongoing', label: 'Devam Eden' },
          { key: 'revision', label: 'Revize', count: revisionTasks.length },
          { key: 'blocked', label: 'Blokajlı', count: blockedTasks.length },
          { key: 'submitted', label: 'İncelemede', count: submittedTasks.length },
          { key: 'due-soon', label: 'Teslim Yakın', count: dueSoonTasks.length },
          { key: 'overdue', label: 'Gecikmiş', count: overdueTasks.length },
          { key: 'completed', label: 'Tamamlanan' },
        ].map(f => (
          <button
            key={f.key}
            className={`btn btn-sm ${activeFilter === f.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveFilter(f.key)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span style={{ marginLeft: 4, opacity: 0.8 }}>({f.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Görev listesi */}
      {filteredTasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><CheckCircle size={48} /></div>
          <div className="empty-state-text">
            {activeFilter === 'all'
              ? 'Henüz size atanmış görev bulunmuyor.'
              : 'Bu kategoride görev bulunmuyor.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusUpdate={handleStatusUpdate}
              onView={(id) => navigate(`/employee/tasks/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
