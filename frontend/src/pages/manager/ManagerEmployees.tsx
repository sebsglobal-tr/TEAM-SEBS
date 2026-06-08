import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search } from 'lucide-react';
import { usersService } from '../../services/users.service';
import { workSessionsService, type EmployeeWorkStat } from '../../services/work-sessions.service';
import { formatDuration } from '../../utils/format';

export function ManagerEmployees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeWorkStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    workSessionsService.getDashboardStats()
      .then((data) => setEmployees(data.employees))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = employees.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.firstName.toLowerCase().includes(q) || e.lastName.toLowerCase().includes(q);
  });

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Çalışanlarım</h1>
        <p className="page-subtitle">Size atanmış çalışanlar</p>
      </div>

      <div className="filters-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-secondary)' }} />
          <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Users size={48} /></div>
          <div className="empty-state-text">Henüz size atanmış çalışan bulunmuyor.</div>
        </div>
      ) : (
        <div className="grid-3">
          {filtered.map((emp) => (
            <div
              className="card"
              key={emp.id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/manager/employees/${emp.id}`)}
            >
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: 'rgba(37,99,235,0.15)', color: '#2563eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '1rem',
                  }}>
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{emp.firstName} {emp.lastName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{emp.position ?? '-'}</div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span className={`badge ${
                      emp.currentStatus === 'ONLINE_ACTIVE' ? 'badge-success' :
                      emp.currentStatus === 'ONLINE_IDLE' ? 'badge-warning' :
                      emp.currentStatus === 'ON_BREAK' ? 'badge-info' : 'badge-default'
                    }`}>
                      {STATUS_LABELS[emp.currentStatus] ?? 'Çevrimdışı'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Aktif:</span> <strong style={{ color: '#10b981' }}>{formatDuration(emp.todayActiveSeconds)}</strong></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Mola:</span> {formatDuration(emp.todayBreakSeconds)}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Görev:</span> {emp.pendingTasks} bekleyen</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Oturum:</span> {emp.hasActiveSession ? '🟢' : '⏹️'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  ONLINE_ACTIVE: 'Aktif',
  ONLINE_IDLE: 'Boşta',
  ON_BREAK: 'Molada',
  OFFLINE: 'Çevrimdışı',
  SCREEN_LOCKED: 'Kilitli',
  WORK_SESSION_ENDED: 'Oturum Bitti',
};
