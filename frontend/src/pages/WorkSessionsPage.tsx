import { useEffect, useState, useCallback } from 'react';
import { Play, Square, Coffee, Clock, Activity } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { workSessionsService, type SessionTimeline } from '../services/work-sessions.service';
import { useAuth } from '../hooks/useAuth';
import { useWorkSessionHeartbeat } from '../hooks/useWorkSessionHeartbeat';
import { formatDuration, formatDateTime, STATUS_LABELS } from '../utils/format';
import type { WorkSessionToday } from '../types';

const EVENT_LABELS: Record<string, string> = {
  SESSION_START: 'Oturum Başladı',
  SESSION_END: 'Oturum Bitti',
  ACTIVE: 'Aktif',
  IDLE: 'Boşta',
  SCREEN_LOCK: 'Ekran Kilitlendi',
  SCREEN_UNLOCK: 'Ekran Açıldı',
  BREAK_START: 'Mola Başladı',
  BREAK_END: 'Mola Bitti',
  OFFLINE: 'Çevrimdışı',
  HEARTBEAT: 'Heartbeat',
};

export function WorkSessionsPage() {
  const { isManager } = useAuth();
  const [data, setData] = useState<WorkSessionToday | null>(null);
  const [teamStats, setTeamStats] = useState<Awaited<ReturnType<typeof workSessionsService.getDashboardStats>> | null>(null);
  const [timeline, setTimeline] = useState<SessionTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);

  const load = useCallback(() => {
    const promises: Promise<unknown>[] = [workSessionsService.getToday().then(setData)];
    if (isManager) {
      promises.push(workSessionsService.getDashboardStats().then(setTeamStats));
    }
    Promise.all(promises).finally(() => setLoading(false));
  }, [isManager]);

  useEffect(() => { load(); }, [load]);

  const activeSession = data?.activeSession;
  useWorkSessionHeartbeat({ isSessionActive: !!activeSession, isOnBreak, onUpdate: load });

  useEffect(() => {
    if (activeSession) {
      workSessionsService.getTimeline(activeSession.id).then(setTimeline).catch(() => setTimeline(null));
    } else {
      setTimeline(null);
    }
  }, [activeSession?.id]);

  const handleAction = async (action: () => Promise<unknown>, onSuccess?: () => void) => {
    setActionLoading(true);
    try {
      await action();
      onSuccess?.();
      load();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isManager ? 'Çalışma Süreleri' : 'Çalışma Sürem'}</h1>
        <p className="page-subtitle">
          {isManager
            ? 'Ekip çalışma süreleri ve anlık durum takibi'
            : 'Günlük çalışma oturumunuz ve süre detayları'}
        </p>
      </div>

      {!isManager && (
        <>
          <div className="stats-grid">
            <StatCard title="Bugünkü Aktif" value={formatDuration(data?.totals.active ?? 0)} icon={Clock} color="var(--success)" />
            <StatCard title="Boşta" value={formatDuration(data?.totals.idle ?? 0)} icon={Clock} color="var(--warning)" />
            <StatCard title="Mola" value={formatDuration(data?.totals.break ?? 0)} icon={Coffee} color="#8b5cf6" />
            <StatCard title="Kilitli" value={formatDuration(data?.totals.locked ?? 0)} icon={Activity} />
          </div>

          <Card
            title="Çalışma Oturumu"
            subtitle={activeSession ? 'Oturum aktif — süre otomatik sayılıyor' : 'Oturum kapalı'}
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
                        <Coffee size={14} /> Mola Bitir
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
            {activeSession && (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Başlangıç: {formatDateTime(activeSession.startedAt)} · Heartbeat her 30 saniyede gönderiliyor
              </p>
            )}
          </Card>

          {timeline && (
            <div style={{ marginTop: '1.5rem' }}>
              <Card title="Oturum Zaman Çizelgesi">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {timeline.activityEvents.map((ev) => (
                    <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: '6px', fontSize: '0.85rem' }}>
                      <span>{EVENT_LABELS[ev.type] ?? ev.type}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{formatDateTime(ev.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <Card title="Bugünkü Oturumlar">
              <table className="table">
                <thead>
                  <tr>
                    <th>Başlangıç</th>
                    <th>Bitiş</th>
                    <th>Aktif</th>
                    <th>Boşta</th>
                    <th>Mola</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{formatDateTime(s.startedAt)}</td>
                      <td>{s.endedAt ? formatDateTime(s.endedAt) : '-'}</td>
                      <td>{formatDuration(s.totalActiveSeconds)}</td>
                      <td>{formatDuration(s.totalIdleSeconds)}</td>
                      <td>{formatDuration(s.totalBreakSeconds)}</td>
                      <td><Badge variant={s.status === 'ACTIVE' ? 'success' : 'default'}>{s.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}

      {isManager && teamStats && (
        <>
          <div className="stats-grid">
            <StatCard title="Çalışan" value={teamStats.summary.totalEmployees} icon={Clock} />
            <StatCard title="Şu An Çalışan" value={teamStats.summary.workingNow} icon={Play} color="var(--success)" />
            <StatCard title="Aktif" value={teamStats.summary.onlineActive} icon={Activity} color="var(--success)" />
            <StatCard title="Bugün Toplam Aktif" value={formatDuration(teamStats.summary.totalActiveSecondsToday)} icon={Clock} color="#3b82f6" />
          </div>

          <Card title="Ekip Çalışma Durumu">
            <table className="table">
              <thead>
                <tr>
                  <th>Çalışan</th>
                  <th>Departman</th>
                  <th>Durum</th>
                  <th>Bugün Aktif</th>
                  <th>Boşta</th>
                  <th>Mola</th>
                  <th>Bekleyen Görev</th>
                  <th>Son Aktif</th>
                </tr>
              </thead>
              <tbody>
                {teamStats.employees.map((emp) => (
                  <tr key={emp.id}>
                    <td>{emp.firstName} {emp.lastName}</td>
                    <td>{emp.department?.name ?? '-'}</td>
                    <td>
                      <Badge variant={
                        emp.currentStatus === 'ONLINE_ACTIVE' ? 'success' :
                        emp.currentStatus === 'ONLINE_IDLE' ? 'warning' :
                        emp.currentStatus === 'ON_BREAK' ? 'info' : 'default'
                      }>
                        {STATUS_LABELS[emp.currentStatus] ?? emp.currentStatus}
                      </Badge>
                    </td>
                    <td>{formatDuration(emp.todayActiveSeconds)}</td>
                    <td>{formatDuration(emp.todayIdleSeconds)}</td>
                    <td>{formatDuration(emp.todayBreakSeconds)}</td>
                    <td>{emp.pendingTasks}</td>
                    <td>{emp.lastActiveAt ? formatDateTime(emp.lastActiveAt) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
