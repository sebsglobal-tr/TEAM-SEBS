import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  FileText,
  Upload,
  Calendar,
  ListTodo,
  ArrowRight,
} from 'lucide-react';
import type { Task } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  URGENT: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Acil', icon: AlertCircle },
  HIGH: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Yüksek', icon: AlertCircle },
  MEDIUM: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', label: 'Orta', icon: Clock },
  LOW: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Düşük', icon: Clock },
};

const STATUS_LABELS: Record<string, string> = {
  TODO: 'Yapılacak',
  IN_PROGRESS: 'Devam Ediyor',
  WAITING_REVIEW: 'İncelemede',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
};

const STATUS_COLORS: Record<string, string> = {
  TODO: '#64748b',
  IN_PROGRESS: '#3b82f6',
  WAITING_REVIEW: '#f59e0b',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
};

function getPriorityColor(priority: string): string {
  return PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG]?.color ?? '#64748b';
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#64748b';
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatRelativeDay(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return 'Bugün';
  if (diffDays === 1) return 'Yarın';
  if (diffDays === -1) return 'Dün';
  if (diffDays > 0) return `${diffDays} gün sonra`;
  return `${Math.abs(diffDays)} gün önce`;
}

function isOverdue(dateStr?: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date() && !isToday(dateStr);
}

function isToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isTomorrow(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString();
}

function isThisWeek(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + (7 - now.getDay()));
  return d > now && d <= weekEnd && !isToday(dateStr) && !isTomorrow(dateStr);
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface DailyTaskViewProps {
  tasks: Task[];
  onStatusChange?: (taskId: string, status: string) => void;
  onViewDetail?: (taskId: string) => void;
  onUploadFile?: (taskId: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  compact?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DailyTaskView({
  tasks,
  onStatusChange,
  onViewDetail,
  onUploadFile,
  loading = false,
  emptyMessage = 'Bugüne ait görev bulunmuyor.',
  compact = false,
}: DailyTaskViewProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [filterStatus, setFilterStatus] = useState('');

  const navigateDay = (direction: number) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + direction);
    setViewDate(d);
  };

  const goToday = () => setViewDate(new Date());

  // Group and filter tasks
  const groupedTasks = useMemo(() => {
    const filtered = filterStatus
      ? tasks.filter((t) => t.status === filterStatus || t.status === 'TODO' && filterStatus === 'TODO')
      : tasks;

    const groups: Array<{ key: string; label: string; icon: typeof Clock; tasks: Task[]; color: string }> = [];

    // Exclude cancelled
    const active = filtered.filter((t) => t.status !== 'CANCELLED');

    const overdue = active.filter((t) => isOverdue(t.dueDate) && t.status !== 'COMPLETED');
    const todayTasks = active.filter((t) => isToday(t.dueDate));
    const tomorrowTasks = active.filter((t) => isTomorrow(t.dueDate));
    const weekTasks = active.filter((t) => isThisWeek(t.dueDate));
    const upcoming = active.filter((t) => {
      if (!t.dueDate) return true;
      return !isOverdue(t.dueDate) && !isToday(t.dueDate) && !isTomorrow(t.dueDate) && !isThisWeek(t.dueDate);
    });
    const completed = active.filter((t) => t.status === 'COMPLETED');

    if (overdue.length) groups.push({ key: 'overdue', label: 'Geciken Görevler', icon: AlertCircle, tasks: overdue, color: '#ef4444' });
    if (todayTasks.length) groups.push({ key: 'today', label: 'Bugün', icon: Calendar, tasks: todayTasks, color: '#3b82f6' });
    if (tomorrowTasks.length) groups.push({ key: 'tomorrow', label: 'Yarın', icon: Calendar, tasks: tomorrowTasks, color: '#8b5cf6' });
    if (weekTasks.length) groups.push({ key: 'week', label: 'Bu Hafta', icon: Calendar, tasks: weekTasks, color: '#10b981' });
    if (upcoming.length) groups.push({ key: 'upcoming', label: 'İleri Tarihli', icon: ArrowRight, tasks: upcoming, color: '#64748b' });
    if (completed.length) groups.push({ key: 'completed', label: 'Tamamlanan', icon: CheckCircle2, tasks: completed, color: '#10b981' });

    return groups;
  }, [tasks, filterStatus]);

  const dateStr = viewDate.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });

  if (loading) {
    return (
      <div className="dtv-loading">
        <div className="dtv-loading-spinner" />
        <span>Görevler yükleniyor...</span>
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="dtv-empty">
        <div className="dtv-empty-icon"><ListTodo size={48} /></div>
        <div className="dtv-empty-text">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={`dtv-container ${compact ? 'dtv-compact' : ''}`}>
      {/* ─── Calendar Header ─── */}
      <div className="dtv-header">
        <div className="dtv-header-left">
          <button className="dtv-nav-btn" onClick={() => navigateDay(-1)} title="Önceki gün">
            <ChevronLeft size={18} />
          </button>
          <div className="dtv-header-date">
            <span className="dtv-date-text">{dateStr}</span>
            <span className="dtv-task-count">{tasks.length} görev</span>
          </div>
          <button className="dtv-nav-btn" onClick={() => navigateDay(1)} title="Sonraki gün">
            <ChevronRight size={18} />
          </button>
          <button className="dtv-today-btn" onClick={goToday}>Bugün</button>
        </div>

        <div className="dtv-header-right">
          <select
            className="dtv-filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Tümü</option>
            <option value="TODO">Yapılacak</option>
            <option value="IN_PROGRESS">Devam Eden</option>
            <option value="WAITING_REVIEW">İncelemede</option>
            <option value="COMPLETED">Tamamlanan</option>
          </select>
        </div>
      </div>

      {/* ─── Groups ─── */}
      <div className="dtv-groups">
        {groupedTasks.length === 0 ? (
          <div className="dtv-empty" style={{ padding: '2rem' }}>
            <CheckCircle2 size={40} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
            <div className="dtv-empty-text">Bu filtreye uygun görev bulunmuyor.</div>
          </div>
        ) : (
          groupedTasks.map((group) => (
            <div key={group.key} className="dtv-group">
              <div className="dtv-group-header" style={{ color: group.color }}>
                <group.icon size={16} />
                <span className="dtv-group-label">{group.label}</span>
                <span className="dtv-group-count">{group.tasks.length}</span>
              </div>
              <div className="dtv-task-list">
                {group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={onStatusChange}
                    onViewDetail={onViewDetail}
                    onUploadFile={onUploadFile}
                    compact={compact}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{dtvStyles}</style>
    </div>
  );
}

// ─── Task Card ──────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onStatusChange,
  onViewDetail,
  onUploadFile,
  compact,
}: {
  task: Task;
  onStatusChange?: (id: string, status: string) => void;
  onViewDetail?: (id: string) => void;
  onUploadFile?: (id: string) => void;
  compact?: boolean;
}) {
  const priorityColor = getPriorityColor(task.priority);
  const statusColor = getStatusColor(task.status);
  const isTaskOverdue = isOverdue(task.dueDate) && task.status !== 'COMPLETED';

  const nextStatus = task.status === 'TODO' ? 'IN_PROGRESS'
    : task.status === 'IN_PROGRESS' ? 'WAITING_REVIEW'
    : task.status === 'WAITING_REVIEW' ? 'COMPLETED'
    : null;

  return (
    <div className={`dtv-task-card ${isTaskOverdue ? 'dtv-overdue' : ''}`}>
      {/* Priority accent bar */}
      <div className="dtv-task-accent" style={{ background: priorityColor }} />

      <div className="dtv-task-body">
        {/* Top row: priority + time + status */}
        <div className="dtv-task-meta">
          <span className="dtv-priority-badge" style={{ background: PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.bg ?? 'transparent', color: priorityColor }}>
            {task.priority}
          </span>
          {task.dueDate && (
            <span className="dtv-task-time" style={{ color: isTaskOverdue ? '#ef4444' : 'var(--text-secondary)' }}>
              <Clock size={12} />
              {formatTime(task.dueDate)}
              <span className="dtv-relative-day">· {formatRelativeDay(task.dueDate)}</span>
            </span>
          )}
          <span className="dtv-status-badge" style={{ background: `${statusColor}18`, color: statusColor }}>
            {STATUS_LABELS[task.status] ?? task.status}
          </span>
        </div>

        {/* Title + description */}
        <div className="dtv-task-content" onClick={() => onViewDetail?.(task.id)}>
          <div className="dtv-task-title">{task.title}</div>
          {task.description && !compact && (
            <div className="dtv-task-desc">{task.description}</div>
          )}
        </div>

        {/* Progress bar */}
        {!compact && (
          <div className="dtv-progress">
            <div className="dtv-progress-bar">
              <div className="dtv-progress-fill" style={{ width: `${task.completionPercent}%`, background: priorityColor }} />
            </div>
            <span className="dtv-progress-text">%{task.completionPercent}</span>
          </div>
        )}

        {/* Bottom: assignee + actions */}
        <div className="dtv-task-footer">
          <div className="dtv-task-assignee">
            {task.assignedTo ? (
              <>
                <div className="dtv-avatar" style={{ background: `${priorityColor}20`, color: priorityColor }}>
                  {task.assignedTo.firstName[0]}{task.assignedTo.lastName[0]}
                </div>
                <span className="dtv-assignee-name">
                  {task.assignedTo.firstName} {task.assignedTo.lastName}
                </span>
              </>
            ) : (
              <span className="dtv-assignee-name" style={{ color: 'var(--text-secondary)' }}>
                <User size={12} /> Atanmamış
              </span>
            )}
            {task.estimatedMinutes && (
              <span className="dtv-estimate">
                <Clock size={11} />
                {task.estimatedMinutes}dk
              </span>
            )}
          </div>

          <div className="dtv-task-actions">
            {nextStatus && onStatusChange && (
              <button
                className="dtv-action-btn"
                onClick={() => onStatusChange(task.id, nextStatus)}
                title={STATUS_LABELS[nextStatus]}
              >
                <ArrowRight size={14} />
              </button>
            )}
            {onUploadFile && (
              <button className="dtv-action-btn" onClick={() => onUploadFile(task.id)} title="Dosya yükle">
                <Upload size={14} />
              </button>
            )}
            {onViewDetail && (
              <button className="dtv-action-btn" onClick={() => onViewDetail(task.id)} title="Detay">
                <FileText size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const dtvStyles = `
.dtv-container {
  --dtv-radius: 14px;
  --dtv-transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.dtv-container.dtv-compact .dtv-task-card {
  padding: 0.5rem;
}

.dtv-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-secondary);
}

.dtv-loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: dtv-spin 0.8s linear infinite;
}

@keyframes dtv-spin { to { transform: rotate(360deg); } }

.dtv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--text-secondary);
  text-align: center;
}

.dtv-empty-icon { opacity: 0.3; margin-bottom: 0.75rem; }
.dtv-empty-text { font-size: 0.9rem; }

/* ─── Header ─── */
.dtv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.dtv-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dtv-nav-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--dtv-transition);
}

.dtv-nav-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.dtv-header-date {
  display: flex;
  flex-direction: column;
  min-width: 200px;
}

.dtv-date-text {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  text-transform: capitalize;
}

.dtv-task-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.dtv-today-btn {
  padding: 0.3rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--accent);
  background: var(--accent-light);
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--dtv-transition);
}

.dtv-today-btn:hover {
  background: var(--accent);
  color: white;
}

.dtv-header-right {
  display: flex;
  gap: 0.5rem;
}

.dtv-filter-select {
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.8rem;
  cursor: pointer;
  outline: none;
}

.dtv-filter-select:focus {
  border-color: var(--accent);
}

/* ─── Groups ─── */
.dtv-groups {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.dtv-group-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 0 0.25rem;
  margin-bottom: 0.5rem;
}

.dtv-group-count {
  margin-left: auto;
  font-size: 0.75rem;
  opacity: 0.6;
}

.dtv-task-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

/* ─── Task Card ─── */
.dtv-task-card {
  display: flex;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--dtv-radius);
  overflow: hidden;
  transition: var(--dtv-transition);
  position: relative;
}

.dtv-task-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
}

[data-theme='dark'] .dtv-task-card:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.dtv-task-card.dtv-overdue {
  border-color: rgba(239,68,68,0.3);
  background: linear-gradient(135deg, rgba(239,68,68,0.03), transparent);
}

.dtv-task-accent {
  width: 4px;
  flex-shrink: 0;
}

.dtv-task-body {
  flex: 1;
  padding: 1rem 1.1rem;
  min-width: 0;
}

.dtv-task-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.dtv-priority-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dtv-task-time {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.dtv-relative-day {
  font-weight: 400;
  opacity: 0.7;
}

.dtv-status-badge {
  margin-left: auto;
  padding: 0.15rem 0.55rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
}

.dtv-task-content {
  cursor: pointer;
  margin-bottom: 0.5rem;
}

.dtv-task-title {
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 0.15rem;
}

.dtv-task-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ─── Progress ─── */
.dtv-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
}

.dtv-progress-bar {
  flex: 1;
  height: 5px;
  background: var(--border);
  border-radius: 99px;
  overflow: hidden;
}

.dtv-progress-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.5s ease;
  min-width: 2px;
}

.dtv-progress-text {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 32px;
  text-align: right;
}

/* ─── Footer ─── */
.dtv-task-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.dtv-task-assignee {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.dtv-avatar {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
}

.dtv-assignee-name {
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dtv-estimate {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-left: 0.5rem;
}

.dtv-task-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.dtv-action-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--dtv-transition);
}

.dtv-action-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
}

/* ─── Responsive ─── */
@media (max-width: 640px) {
  .dtv-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .dtv-header-date { min-width: auto; }
  .dtv-task-meta { gap: 0.35rem; }
  .dtv-status-badge { margin-left: 0; }
  .dtv-task-footer { flex-wrap: wrap; }
}
`;
