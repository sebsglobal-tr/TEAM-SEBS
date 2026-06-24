import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTodo, Search, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { tasksService } from '../../services/tasks.service';
import { formatDate } from '../../utils/format';
import type { Task } from '../../types';

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

type FilterKey = 'all' | 'active' | 'submitted' | 'blocked' | 'completed';

export function ManagerTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await tasksService.getAll({ limit: '100' });
        setTasks(data);
      } catch (err) {
        console.error('Görevler yüklenirken hata:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  let filtered = tasks.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.assignedTo?.firstName?.toLowerCase().includes(q);
  });

  switch (activeFilter) {
    case 'active':
      filtered = filtered.filter(t => ['IN_PROGRESS', 'ASSIGNED_TO_EMPLOYEE', 'PENDING', 'PARTIALLY_COMPLETED'].includes(t.status));
      break;
    case 'submitted':
      filtered = filtered.filter(t => t.status === 'SUBMITTED');
      break;
    case 'blocked':
      filtered = filtered.filter(t => t.status === 'BLOCKED');
      break;
    case 'completed':
      filtered = filtered.filter(t => ['MANAGER_APPROVED', 'ADMIN_APPROVED', 'CANCELLED'].includes(t.status));
      break;
  }

  const counts = {
    active: tasks.filter(t => ['IN_PROGRESS', 'ASSIGNED_TO_EMPLOYEE', 'PENDING', 'PARTIALLY_COMPLETED'].includes(t.status)).length,
    submitted: tasks.filter(t => t.status === 'SUBMITTED').length,
    blocked: tasks.filter(t => t.status === 'BLOCKED').length,
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Görevler</h1>
        <p className="page-subtitle">Sistemdeki tüm görevler ({tasks.length})</p>
      </div>

      {/* Filtreler */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {[
          { key: 'all', label: 'Tümü', count: tasks.length },
          { key: 'active', label: 'Devam Eden', count: counts.active },
          { key: 'submitted', label: 'İncelemede', count: counts.submitted },
          { key: 'blocked', label: 'Blokajlı', count: counts.blocked },
          { key: 'completed', label: 'Tamamlanan' },
        ].map((f) => (
          <button
            key={f.key}
            className={`btn btn-sm ${activeFilter === f.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveFilter(f.key as FilterKey)}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && <span style={{ marginLeft: 4, opacity: 0.8 }}>({f.count})</span>}
          </button>
        ))}
      </div>

      {/* Arama */}
      <div className="filters-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-secondary)' }} />
          <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Görev ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ListTodo size={48} /></div>
          <div className="empty-state-text">Görev bulunamadı.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {filtered.map((task) => (
            <div
              key={task.id}
              className="card"
              style={{ cursor: 'pointer', borderLeft: `4px solid ${PRIORITY_COLORS[task.priority] ?? '#64748b'}` }}
              onClick={() => navigate(`/manager/tasks/${task.id}`)}
            >
              <div className="card-body" style={{ padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{task.title}</strong>
                      <span className={`badge ${
                        task.status === 'SUBMITTED' ? 'badge-warning' :
                        task.status === 'BLOCKED' || task.status === 'REVISION_REQUESTED' ? 'badge-danger' :
                        task.status === 'IN_PROGRESS' ? 'badge-info' :
                        task.status === 'MANAGER_APPROVED' || task.status === 'ADMIN_APPROVED' ? 'badge-success' :
                        'badge-default'
                      }`} style={{ fontSize: '0.65rem' }}>
                        {STATUS_LABELS[task.status] ?? task.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {task.assignedTo && <span>👤 {task.assignedTo.firstName} {task.assignedTo.lastName}</span>}
                      {task.dueDate && <span>📅 {formatDate(task.dueDate)}</span>}
                      {task._count && <span>📎 {task._count.subTasks || 0} alt görev</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {task.isOverdue && <span className="badge badge-danger">Gecikti</span>}
                    {task.completionPercent > 0 && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>%{task.completionPercent}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
