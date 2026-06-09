import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, CheckCircle, FileText, AlertCircle,
  ArrowRight, FolderOpen, BarChart3,
} from 'lucide-react';
import { tasksService } from '../../services/tasks.service';
import { api } from '../../services/api';
import { formatDateTime, formatDuration, formatDate } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import type { Task } from '../../types';

const STATUS_LABELS: Record<string, string> = {
  MANAGER_APPROVED: 'Onaylandı',
  ADMIN_APPROVED: 'Admin Onaylı',
  CANCELLED: 'İptal',
  REVISION_REQUESTED: 'Revize İstendi',
  SUBMITTED: 'İncelemede',
};

export function EmployeeHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('tasks');
  const [pastTasks, setPastTasks] = useState<Task[]>([]);
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const tasks = await tasksService.getAll({ limit: '100' });
      const myTasks = tasks.filter(t => t.assignedToId === user?.id);

      // Completed/approved/closed tasks
      const completed = myTasks.filter(t =>
        ['MANAGER_APPROVED', 'ADMIN_APPROVED', 'CANCELLED', 'REVISION_REQUESTED', 'SUBMITTED'].includes(t.status)
      );
      setPastTasks(completed);

      // Load reports
      const { data: reports } = await api.get('/reports', { params: { limit: '50' } });
      setPastReports(Array.isArray(reports) ? reports : reports?.data ?? []);

      // Load past work sessions
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sessions = await api.get(`/work-sessions/user/${user?.id}`, {
        params: {
          startDate: thirtyDaysAgo.toISOString(),
          endDate: today.toISOString(),
        },
      });
      setPastSessions(Array.isArray(sessions.data) ? sessions.data : []);
    } catch (err) {
      console.error('Geçmiş verisi yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Geçmiş</h1>
        <p className="page-subtitle">Tamamlanan görevler, raporlar ve çalışma geçmişiniz</p>
      </div>

      {/* Tablar */}
      <div style={{
        display: 'flex', gap: '0.4rem', marginBottom: '1rem',
        borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem',
      }}>
        {[
          { key: 'tasks', icon: CheckCircle, label: 'Tamamlanan Görevler', count: pastTasks.length },
          { key: 'reports', icon: FileText, label: 'Raporlar', count: pastReports.length },
          { key: 'sessions', icon: Clock, label: 'Çalışma Süreleri', count: pastSessions.length },
        ].map(tab => (
          <button
            key={tab.key}
            className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab.key)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <tab.icon size={14} />
            {tab.label}
            <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>({tab.count})</span>
          </button>
        ))}
      </div>

      {/* ─── Tamamlanan Görevler ─── */}
      {activeTab === 'tasks' && (
        <>
          {pastTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><CheckCircle size={48} /></div>
              <div className="empty-state-text">Henüz tamamlanmış görev bulunmuyor.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pastTasks.map(task => (
                <div key={task.id} className="card" style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/employee/tasks/${task.id}`)}>
                  <div className="card-body" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: task.status === 'MANAGER_APPROVED' || task.status === 'ADMIN_APPROVED' ? '#10b981' :
                                  task.status === 'REVISION_REQUESTED' ? '#ef4444' : '#6b7280',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{task.title}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {STATUS_LABELS[task.status] ?? task.status} · {formatDateTime(task.updatedAt)}
                      </div>
                    </div>
                    <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Raporlar ─── */}
      {activeTab === 'reports' && (
        <>
          {pastReports.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><FileText size={48} /></div>
              <div className="empty-state-text">Henüz rapor bulunmuyor.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pastReports.map((report: any) => (
                <div key={report.id} className="card" style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/employee/reports/${report.id}`)}>
                  <div className="card-body" style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{report.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {formatDateTime(report.createdAt)}
                      {report.feedbacks?.length > 0 && ` · ${report.feedbacks.length} geri bildirim`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Çalışma Süreleri ─── */}
      {activeTab === 'sessions' && (
        <>
          {pastSessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Clock size={48} /></div>
              <div className="empty-state-text">Henüz çalışma kaydı bulunmuyor.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pastSessions.map((session: any) => (
                <div key={session.id} className="card">
                  <div className="card-body" style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                          {formatDateTime(session.startedAt)}
                          {session.endedAt && (
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                              {' → '}{formatDateTime(session.endedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                        <span style={{ color: '#10b981' }}>Aktif: {formatDuration(session.totalActiveSeconds)}</span>
                        <span style={{ color: '#f59e0b' }}>Mola: {formatDuration(session.totalBreakSeconds)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
