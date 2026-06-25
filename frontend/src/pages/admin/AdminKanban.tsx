import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MoreHorizontal, User, Calendar, Clock,
  AlertCircle, CheckCircle2, ArrowLeft,
} from 'lucide-react';
import { tasksService } from '../../services/tasks.service';
import { formatDate } from '../../utils/format';
import type { Task } from '../../types';

const STATUS_COLUMNS = [
  { key: 'POOL', label: '📋 Havuz', color: '#64748b' },
  { key: 'ASSIGNED_TO_MANAGER', label: '👤 Yöneticiye Atandı', color: '#3b82f6' },
  { key: 'ASSIGNED_TO_EMPLOYEE', label: '👥 Çalışana Atandı', color: '#8b5cf6' },
  { key: 'IN_PROGRESS', label: '⚙️ Devam Ediyor', color: '#f59e0b' },
  { key: 'SUBMITTED', label: '🔍 İncelemede', color: '#f97316' },
  { key: 'MANAGER_APPROVED', label: '✅ Onaylandı', color: '#10b981' },
];

const STATUS_LABELS: Record<string, string> = {
  POOL: 'Havuzda', ASSIGNED_TO_MANAGER: 'Yöneticiye Atandı',
  ASSIGNED_TO_EMPLOYEE: 'Çalışana Atandı', PENDING: 'Beklemede',
  IN_PROGRESS: 'Devam Ediyor', PARTIALLY_COMPLETED: 'Kısmen Tamamlandı',
  BLOCKED: 'Blokaj Var', SUBMITTED: 'İncelemede',
  REVISION_REQUESTED: 'Revize İstendi', MANAGER_APPROVED: 'Onaylandı',
  ADMIN_APPROVED: 'Admin Onaylı', CANCELLED: 'İptal',
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#3b82f6', LOW: '#6b7280',
};

export function AdminKanban() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const dragOverCol = useRef<string | null>(null);

  useEffect(() => {
    tasksService.getAll({ limit: '200' })
      .then(setTasks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Group tasks by status
  const columns = STATUS_COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => {
      // Map similar statuses to columns
      if (col.key === 'POOL') return t.status === 'POOL' || t.status === 'PENDING';
      if (col.key === 'ASSIGNED_TO_MANAGER') return t.status === 'ASSIGNED_TO_MANAGER';
      if (col.key === 'ASSIGNED_TO_EMPLOYEE') return t.status === 'ASSIGNED_TO_EMPLOYEE' || t.status === 'PARTIALLY_COMPLETED';
      if (col.key === 'IN_PROGRESS') return t.status === 'IN_PROGRESS' || t.status === 'BLOCKED' || t.status === 'REVISION_REQUESTED';
      if (col.key === 'SUBMITTED') return t.status === 'SUBMITTED';
      if (col.key === 'MANAGER_APPROVED') return t.status === 'MANAGER_APPROVED' || t.status === 'ADMIN_APPROVED' || t.status === 'CANCELLED';
      return false;
    }),
  }));

  const handleDragStart = (taskId: string) => {
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    dragOverCol.current = colKey;
  };

  const handleDrop = async (colKey: string) => {
    if (!draggedTask) return;
    const task = tasks.find((t) => t.id === draggedTask);
    if (!task) return;

    // Map column to target status
    const statusMap: Record<string, string> = {
      'POOL': 'PENDING',
      'ASSIGNED_TO_MANAGER': 'ASSIGNED_TO_MANAGER',
      'ASSIGNED_TO_EMPLOYEE': 'ASSIGNED_TO_EMPLOYEE',
      'IN_PROGRESS': 'IN_PROGRESS',
      'SUBMITTED': 'SUBMITTED',
      'MANAGER_APPROVED': 'MANAGER_APPROVED',
    };

    const targetStatus = statusMap[colKey];
    if (!targetStatus || task.status === targetStatus) {
      setDraggedTask(null);
      return;
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === draggedTask ? { ...t, status: targetStatus as any } : t)),
    );

    try {
      await tasksService.updateStatus(draggedTask, targetStatus);
    } catch (err) {
      console.error('Kanban status update failed:', err);
      // Revert
      setTasks((prev) =>
        prev.map((t) => (t.id === draggedTask ? { ...t, status: task.status } : t)),
      );
    }
    setDraggedTask(null);
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/tasks')}>
          <ArrowLeft size={16} /> Liste
        </button>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Kanban Board</h1>
          <p className="page-subtitle" style={{ margin: '0.25rem 0 0 0' }}>Görevleri sürükle-bırak ile yönetin</p>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '1rem',
        minHeight: 'calc(100vh - 200px)',
      }}>
        {columns.map((col) => (
          <div
            key={col.key}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDrop={() => handleDrop(col.key)}
            onDragLeave={() => { dragOverCol.current = null; }}
            style={{
              minWidth: 280, maxWidth: 320, flex: 1,
              background: 'var(--bg-primary)', borderRadius: 12,
              border: `1px solid ${dragOverCol.current === col.key ? col.color : 'var(--border)'}`,
              display: 'flex', flexDirection: 'column', maxHeight: '100%',
              transition: 'border-color 0.15s',
            }}
          >
            {/* Column Header */}
            <div style={{
              padding: '0.75rem 1rem', borderBottom: `2px solid ${col.color}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{col.label}</span>
              <span style={{
                background: `${col.color}20`, color: col.color, borderRadius: 999,
                padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700,
              }}>{col.tasks.length}</span>
            </div>

            {/* Tasks */}
            <div style={{
              padding: '0.5rem', overflowY: 'auto', flex: 1,
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
            }}>
              {col.tasks.length === 0 ? (
                <div style={{
                  padding: '1.5rem 0.5rem', textAlign: 'center',
                  color: 'var(--text-secondary)', fontSize: '0.78rem',
                }}>
                  Görev yok
                </div>
              ) : (
                col.tasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    onClick={() => navigate(`/admin/tasks/${task.id}`)}
                    style={{
                      padding: '0.65rem 0.75rem', borderRadius: 10,
                      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                      borderLeft: `3px solid ${PRIORITY_COLORS[task.priority] ?? '#64748b'}`,
                      cursor: 'grab', transition: 'all 0.12s',
                      opacity: draggedTask === task.id ? 0.5 : 1,
                      boxShadow: draggedTask === task.id ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      {task.title}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                      {task.assignedTo && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <User size={10} /> {task.assignedTo.firstName[0]}
                        </span>
                      )}
                      {task.dueDate && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: 2,
                          color: task.isOverdue ? '#ef4444' : undefined,
                        }}>
                          <Calendar size={10} /> {formatDate(task.dueDate)}
                        </span>
                      )}
                      {task.completionPercent > 0 && (
                        <span>%{task.completionPercent}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
