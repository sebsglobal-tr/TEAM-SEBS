import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Clock, BarChart3, Activity, Coffee, UserCheck, ListTodo } from 'lucide-react';
import { workSessionsService, type DashboardWorkStats } from '../../services/work-sessions.service';
import { tasksService } from '../../services/tasks.service';
import { DailyTaskView } from '../../components/DailyTaskView';
import { formatDuration } from '../../utils/format';
import type { Task } from '../../types';

const STATUS_LABELS: Record<string, string> = {
  ONLINE_ACTIVE: 'Aktif',
  ONLINE_IDLE: 'Boşta',
  ON_BREAK: 'Molada',
  OFFLINE: 'Çevrimdışı',
  SCREEN_LOCKED: 'Kilitli',
  WORK_SESSION_ENDED: 'Oturum Bitti',
};

export function ManagerDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardWorkStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsData, tasksData] = await Promise.all([
          workSessionsService.getDashboardStats(),
          tasksService.getAll({ limit: "20" }),
        ]);
        setStats(statsData);
        setTasks(tasksData);
      } catch (err) {
        console.error('Dashboard yüklenirken hata:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Yönetici Dashboard</h1>
        <p className="page-subtitle">Ekibinizin anlık durumu ve günlük görev takvimi</p>
      </div>

      {/* Özet Kartları */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon manager"><Users size={20} /></div>
          <div>
            <div className="stat-card-label">Ekibimdeki Çalışanlar</div>
            <div className="stat-card-value">{summary?.totalEmployees ?? 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon manager" style={{ color: '#10b981', background: 'rgba(16,185,129,0.15)' }}><Activity size={20} /></div>
          <div>
            <div className="stat-card-label">Şu An Çalışan</div>
            <div className="stat-card-value">{summary?.workingNow ?? 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon manager" style={{ color: '#10b981', background: 'rgba(16,185,129,0.15)' }}><UserCheck size={20} /></div>
          <div>
            <div className="stat-card-label">Aktif</div>
            <div className="stat-card-value">{summary?.onlineActive ?? 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon manager" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.15)' }}><Clock size={20} /></div>
          <div>
            <div className="stat-card-label">Boşta</div>
            <div className="stat-card-value">{summary?.onlineIdle ?? 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon manager" style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.15)' }}><Coffee size={20} /></div>
          <div>
            <div className="stat-card-label">Molada</div>
            <div className="stat-card-value">{summary?.onBreak ?? 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon manager" style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.15)' }}><BarChart3 size={20} /></div>
          <div>
            <div className="stat-card-label">Bugün Ekip Toplam</div>
            <div className="stat-card-value">{formatDuration(summary?.totalActiveSecondsToday ?? 0)}</div>
          </div>
        </div>
      </div>

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
            Ekibi Gör
          </button>
        </div>
        <div className="card-body" style={{ paddingTop: '0.5rem' }}>
          <DailyTaskView
            tasks={tasks}
            onStatusChange={handleStatusChange}
            onViewDetail={(id) => navigate(`/tasks/${id}`)}
          />
        </div>
      </div>

      {/* Çalışan Tablosu */}
      {stats?.employees && stats.employees.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Ekibim</div>
              <div className="card-subtitle">Size atanmış çalışanların durumu</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/manager/employees')}>
              Tümünü Gör
            </button>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Çalışan</th>
                  <th>Pozisyon</th>
                  <th>Durum</th>
                  <th>Bugün Aktif</th>
                  <th>Mola</th>
                  <th>Bekleyen Görev</th>
                </tr>
              </thead>
              <tbody>
                {stats.employees.map((emp) => (
                  <tr key={emp.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/manager/employees/${emp.id}`)}>
                    <td style={{ fontWeight: 500 }}>{emp.firstName} {emp.lastName}</td>
                    <td>{emp.position ?? '-'}</td>
                    <td>
                      <span className={`badge ${
                        emp.currentStatus === 'ONLINE_ACTIVE' ? 'badge-success' :
                        emp.currentStatus === 'ONLINE_IDLE' ? 'badge-warning' :
                        emp.currentStatus === 'ON_BREAK' ? 'badge-info' : 'badge-default'
                      }`}>
                        {STATUS_LABELS[emp.currentStatus] ?? 'Çevrimdışı'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>{formatDuration(emp.todayActiveSeconds)}</td>
                    <td>{formatDuration(emp.todayBreakSeconds)}</td>
                    <td>{emp.pendingTasks}</td>
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
