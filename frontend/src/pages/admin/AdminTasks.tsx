import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ListTodo, Plus, Users, AlertCircle, Clock, CheckCircle2,
  UserCheck, Ban, Search, FileText,
} from 'lucide-react';
import { tasksService } from '../../services/tasks.service';
import { formatDuration, formatDate, formatDateTime } from '../../utils/format';
import type { Task } from '../../types';

type TabKey = 'all' | 'pool' | 'assigned-to-managers' | 'distributed' | 'completed' | 'overdue' | 'blocked';

const TABS: Array<{ key: TabKey; label: string; icon: any }> = [
  { key: 'all', label: 'Tüm Görevler', icon: ListTodo },
  { key: 'pool', label: 'Havuzdakiler', icon: Users },
  { key: 'assigned-to-managers', label: 'Yöneticilere Atanan', icon: UserCheck },
  { key: 'distributed', label: 'Çalışanlara Dağıtılan', icon: Users },
  { key: 'overdue', label: 'Gecikenler', icon: Clock },
  { key: 'blocked', label: 'Blokajlılar', icon: AlertCircle },
  { key: 'completed', label: 'Tamamlananlar', icon: CheckCircle2 },
];

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: '#ef4444',
  HIGH: '#f59e0b',
  MEDIUM: '#3b82f6',
  LOW: '#10b981',
};

const STATUS_LABELS: Record<string, string> = {
  POOL: 'Havuzda',
  ASSIGNED_TO_MANAGER: 'Yöneticiye Atandı',
  ASSIGNED_TO_EMPLOYEE: 'Çalışana Atandı',
  PENDING: 'Beklemede',
  IN_PROGRESS: 'Devam Ediyor',
  PARTIALLY_COMPLETED: 'Kısmen Tamamlandı',
  BLOCKED: 'Blokaj Var',
  SUBMITTED: 'Teslim Edildi',
  REVISION_REQUESTED: 'Revize İstendi',
  MANAGER_APPROVED: 'Yönetici Onayladı',
  ADMIN_APPROVED: 'Admin Onayladı',
  CANCELLED: 'İptal',
};

function getFilter(tab: TabKey): Record<string, string | undefined> {
  switch (tab) {
    case 'pool': return { pool: 'true' };
    case 'assigned-to-managers': return { status: 'ASSIGNED_TO_MANAGER' };
    case 'distributed': return { status: 'ASSIGNED_TO_EMPLOYEE' };
    case 'overdue': return { overdue: 'true' };
    case 'blocked': return { status: 'BLOCKED' };
    case 'completed': return { status: 'MANAGER_APPROVED' };
    default: return {};
  }
}

export function AdminTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [taskData, statsData] = await Promise.all([
          tasksService.getAll(getFilter(activeTab)),
          tasksService.getStats(),
        ]);
        setTasks(taskData);
        setStats(statsData);
      } catch (err) {
        console.error('Görevler yüklenirken hata:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeTab]);

  const filtered = tasks.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.assignedTo?.firstName?.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">Görev Yönetimi</h1>
          <p className="page-subtitle">Tüm görevleri görüntüleyin, havuzdan yöneticilere atayın</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/tasks/bulk-create')}>
          <Plus size={16} /> Toplu Görev Ekle
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid" style={{ marginBottom: '1rem' }}>
          <div className="stat-card">
            <div className="stat-card-icon admin"><ListTodo size={20} /></div>
            <div><div className="stat-card-label">Toplam</div><div className="stat-card-value">{stats.total}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon admin" style={{ color: '#64748b', background: 'rgba(100,116,139,0.15)' }}><Users size={20} /></div>
            <div><div className="stat-card-label">Havuzda</div><div className="stat-card-value">{stats.pool}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon admin" style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.15)' }}><UserCheck size={20} /></div>
            <div><div className="stat-card-label">Yöneticiye Atanan</div><div className="stat-card-value">{stats.assignedToManager}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon admin" style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.15)' }}><Users size={20} /></div>
            <div><div className="stat-card-label">Çalışana Dağıtılan</div><div className="stat-card-value">{stats.assignedToEmployee}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon admin" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.15)' }}><Clock size={20} /></div>
            <div><div className="stat-card-label">Geciken</div><div className="stat-card-value">{stats.overdue}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon admin" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.15)' }}><AlertCircle size={20} /></div>
            <div><div className="stat-card-label">Blokajlı</div><div className="stat-card-value">{stats.blocked}</div></div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="filters-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-secondary)' }} />
          <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Görev ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Task List */}
      {loading ? <div className="loading-spinner">Yükleniyor...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><ListTodo size={48} /></div>
              <div className="empty-state-text">Bu kategoride görev bulunmuyor.</div>
            </div>
          ) : (
            filtered.map((task) => (
              <div
                key={task.id}
                className="card"
                style={{ cursor: 'pointer', borderLeft: `4px solid ${PRIORITY_COLORS[task.priority] ?? '#64748b'}` }}
                onClick={() => navigate(`/admin/tasks/${task.id}`)}
              >
                <div className="card-body" style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                        <strong style={{ fontSize: '0.9rem' }}>{task.title}</strong>
                        <span className={`badge ${
                          task.status === 'POOL' ? 'badge-default' :
                          task.status === 'BLOCKED' ? 'badge-danger' :
                          task.status === 'SUBMITTED' || task.status === 'IN_PROGRESS' ? 'badge-info' :
                          task.status === 'MANAGER_APPROVED' || task.status === 'ADMIN_APPROVED' ? 'badge-success' :
                          task.status === 'REVISION_REQUESTED' ? 'badge-warning' :
                          'badge-default'
                        }`} style={{ fontSize: '0.65rem' }}>
                          {STATUS_LABELS[task.status] ?? task.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {task.assignedTo && <span><UserCheck size={12} /> {task.assignedTo.firstName} {task.assignedTo.lastName}</span>}
                        {task.responsibleManager && <span>📋 {task.responsibleManager.firstName} {task.responsibleManager.lastName}</span>}
                        {task.dueDate && <span style={{ color: new Date(task.dueDate) < new Date() && task.status !== 'MANAGER_APPROVED' ? '#ef4444' : undefined }}>
                          ⏰ {formatDate(task.dueDate)}
                        </span>}
                        {task._count && <span>{task._count.subTasks} alt görev</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      {task.isOverdue && <span className="badge badge-danger">Gecikti</span>}
                      {task.completionPercent > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>%{task.completionPercent}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
