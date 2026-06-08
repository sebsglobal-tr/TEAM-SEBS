import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Clock, Coffee, Play, Square } from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { tasksService } from '../services/tasks.service';
import { workSessionsService } from '../services/work-sessions.service';
import { useWorkSessionHeartbeat } from '../hooks/useWorkSessionHeartbeat';
import { formatDuration, TASK_STATUS_LABELS } from '../utils/format';
import type { Task, WorkSessionToday } from '../types';

export function EmployeeDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [session, setSession] = useState<WorkSessionToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);

  const loadData = useCallback(() => {
    Promise.all([tasksService.getAll(), workSessionsService.getToday()])
      .then(([t, s]) => {
        setTasks(t);
        setSession(s);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const activeSession = session?.activeSession;
  useWorkSessionHeartbeat(!!activeSession, isOnBreak, loadData);

  const handleAction = async (action: () => Promise<unknown>, onSuccess?: () => void) => {
    setActionLoading(true);
    try {
      await action();
      onSuccess?.();
      loadData();
    } finally {
      setActionLoading(false);
    }
  };

  const myTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Çalışan Dashboard</h1>
        <p className="page-subtitle">Bugünkü görevleriniz ve çalışma durumunuz</p>
      </div>

      <div className="stats-grid">
        <StatCard title="Bugünkü Aktif Süre" value={formatDuration(session?.totals.active ?? 0)} icon={Clock} color="var(--success)" />
        <StatCard title="Boşta Süre" value={formatDuration(session?.totals.idle ?? 0)} icon={Clock} color="var(--warning)" />
        <StatCard title="Mola Süresi" value={formatDuration(session?.totals.break ?? 0)} icon={Coffee} color="#8b5cf6" />
        <StatCard title="Aktif Görevler" value={myTasks.length} icon={CheckSquare} />
      </div>

      <Card
        title="Çalışma Oturumu"
        subtitle={activeSession ? 'Oturum aktif — süre sayılıyor' : 'Oturum kapalı'}
        action={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!activeSession ? (
              <Button size="sm" onClick={() => handleAction(() => workSessionsService.start())} loading={actionLoading}>
                <Play size={14} /> Başla
              </Button>
            ) : (
              <>
                {!isOnBreak ? (
                  <Button size="sm" variant="secondary" onClick={() => handleAction(() => workSessionsService.startBreak(), () => setIsOnBreak(true))} loading={actionLoading}>
                    <Coffee size={14} /> Mola
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => handleAction(() => workSessionsService.endBreak(), () => setIsOnBreak(false))} loading={actionLoading}>
                    Mola Bitir
                  </Button>
                )}
                <Button size="sm" variant="danger" onClick={() => handleAction(() => workSessionsService.stop(), () => setIsOnBreak(false))} loading={actionLoading}>
                  <Square size={14} /> Bitir
                </Button>
              </>
            )}
          </div>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {activeSession
            ? `Oturum başlangıcı: ${new Date(activeSession.startedAt).toLocaleTimeString('tr-TR')}`
            : 'Çalışmaya başlamak için butona tıklayın. Süre yalnızca aktif kullanımda sayılır.'}
        </p>
        <Link to="/work-sessions" style={{ fontSize: '0.85rem', color: 'var(--accent)', marginTop: '0.5rem', display: 'inline-block' }}>
          Detaylı çalışma süresi →
        </Link>
      </Card>

      <div style={{ marginTop: '1.5rem' }}>
        <Card title="Bugünkü Görevlerim">
          <table className="table">
            <thead>
              <tr>
                <th>Görev</th>
                <th>Öncelik</th>
                <th>Durum</th>
                <th>İlerleme</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Görev bulunamadı</td></tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <Link to={`/tasks/${task.id}`} style={{ color: 'var(--accent)' }}>{task.title}</Link>
                    </td>
                    <td><Badge variant={task.priority === 'URGENT' ? 'danger' : 'default'}>{task.priority}</Badge></td>
                    <td>{TASK_STATUS_LABELS[task.status]}</td>
                    <td>%{task.completionPercent}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
