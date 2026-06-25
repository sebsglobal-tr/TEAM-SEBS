import { useEffect, useState } from 'react';
import {
  BarChart3, TrendingUp, Clock, CheckCircle,
  Users, Coffee, AlertTriangle, Activity,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatDuration } from '../../utils/format';

interface EmployeePerf {
  id: string;
  firstName: string;
  lastName: string;
  department?: { name: string };
  stats: {
    totalActiveSeconds: number;
    totalBreakSeconds: number;
    totalIdleSeconds: number;
    taskCompletionRate: number;
    onTimeRate: number;
    reportSubmissionRate: number;
    avgActivePerDay: number;
    workDays: number;
  };
}

export function AdminPerformance() {
  const [employees, setEmployees] = useState<EmployeePerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    const load = async () => {
      try {
        const [sessionsRes, tasksRes, reportsRes] = await Promise.all([
          api.get('/work-sessions/dashboard-stats'),
          api.get('/tasks', { params: { limit: '500' } }),
          api.get('/reports', { params: { limit: '500' } }),
        ]);

        const stats = sessionsRes.data as any;
        const tasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];
        const reports = Array.isArray(reportsRes.data) ? reportsRes.data : reportsRes.data?.data ?? [];

        const perfData: EmployeePerf[] = (stats.employees || []).map((emp: any) => {
          const empTasks = tasks.filter((t: any) => t.assignedToId === emp.id);
          const totalTasks = empTasks.length;
          const completedTasks = empTasks.filter((t: any) =>
            ['MANAGER_APPROVED', 'ADMIN_APPROVED'].includes(t.status)
          ).length;
          const overdueTasks = empTasks.filter((t: any) => t.isOverdue).length;
          const empReports = reports.filter((r: any) => r.user?.id === emp.id);
          const submittedReports = empReports.length;
          const approvedReports = empReports.filter((r: any) => r.status === 'APPROVED').length;

          const avgActive = emp.todayActiveSeconds || 0;

          return {
            id: emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            department: emp.department,
            stats: {
              totalActiveSeconds: emp.todayActiveSeconds || 0,
              totalBreakSeconds: emp.todayBreakSeconds || 0,
              totalIdleSeconds: emp.todayIdleSeconds || 0,
              taskCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
              onTimeRate: completedTasks > 0
                ? Math.round(((completedTasks - overdueTasks) / completedTasks) * 100)
                : 100,
              reportSubmissionRate: submittedReports > 0
                ? Math.round((approvedReports / submittedReports) * 100)
                : 0,
              avgActivePerDay: avgActive,
              workDays: 1,
            },
          };
        });

        setEmployees(perfData);
      } catch (err) {
        console.error('Performans verileri yüklenirken hata:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  const avgCompletion = employees.length > 0
    ? Math.round(employees.reduce((sum, e) => sum + e.stats.taskCompletionRate, 0) / employees.length)
    : 0;
  const avgActive = employees.length > 0
    ? Math.round(employees.reduce((sum, e) => sum + e.stats.avgActivePerDay, 0) / employees.length)
    : 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Performans</h1>
        <p className="page-subtitle">Çalışan performans metrikleri</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card" style={{ borderLeft: '3px solid #7c3aed' }}>
          <div className="stat-card-icon admin"><BarChart3 size={20} /></div>
          <div>
            <div className="stat-card-label">Ort. Görev Tamamlama</div>
            <div className="stat-card-value">{avgCompletion}%</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #10b981' }}>
          <div className="stat-card-icon admin" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <Clock size={20} />
          </div>
          <div>
            <div className="stat-card-label">Ort. Günlük Aktif</div>
            <div className="stat-card-value">{formatDuration(avgActive)}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #3b82f6' }}>
          <div className="stat-card-icon admin" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
            <Users size={20} />
          </div>
          <div>
            <div className="stat-card-label">Çalışan Sayısı</div>
            <div className="stat-card-value">{employees.length}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><TrendingUp size={16} /> Çalışan Bazında Performans</div>
          <select className="form-select" style={{ width: 140 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="week">Bu Hafta</option>
            <option value="month">Bu Ay</option>
          </select>
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Çalışan</th>
                <th>Departman</th>
                <th>Görev Tamamlama</th>
                <th>Zamanında Teslim</th>
                <th>Günlük Aktif</th>
                <th>Mola</th>
                <th>Rapor Oranı</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Henüz çalışan bulunmuyor.
                </td></tr>
              ) : (
                employees.map((emp) => {
                  const completionColor = emp.stats.taskCompletionRate > 70 ? '#10b981' : emp.stats.taskCompletionRate > 40 ? '#f59e0b' : '#ef4444';
                  return (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 500 }}>{emp.firstName} {emp.lastName}</td>
                      <td>{emp.department?.name ?? '-'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${emp.stats.taskCompletionRate}%`, height: '100%', background: completionColor, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: completionColor }}>%{emp.stats.taskCompletionRate}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: emp.stats.onTimeRate > 80 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                          %{emp.stats.onTimeRate}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#10b981' }}>{formatDuration(emp.stats.avgActivePerDay)}</td>
                      <td>{formatDuration(emp.stats.totalBreakSeconds)}</td>
                      <td>
                        <span className={`badge ${emp.stats.reportSubmissionRate > 70 ? 'badge-success' : 'badge-warning'}`}>
                          %{emp.stats.reportSubmissionRate}
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
    </div>
  );
}
