import { useEffect, useState } from 'react';
import { Users, UserCheck, Coffee, Clock, CheckSquare, FileUp, Activity, Download, FileText, Play, Square } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { tasksService } from '../services/tasks.service';
import { workSessionsService } from '../services/work-sessions.service';
import { filesService, type FileRecord } from '../services/files.service';
import { useAuth } from '../hooks/useAuth';
import { useWorkSessionHeartbeat } from '../hooks/useWorkSessionHeartbeat';
import { formatDuration, STATUS_LABELS, formatDateTime } from '../utils/format';
import type { Task, WorkSessionToday } from '../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminDashboard() {
  const { isSuperAdmin } = useAuth();
  const isManager = !isSuperAdmin;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workStats, setWorkStats] = useState<Awaited<ReturnType<typeof workSessionsService.getDashboardStats>> | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [session, setSession] = useState<WorkSessionToday | null>(null);

  const load = () => {
    const promises: Promise<unknown>[] = [
      tasksService.getAll(),
      workSessionsService.getToday(),
    ];

    if (isManager) {
      promises.push(workSessionsService.getDashboardStats());
      promises.push(filesService.getAll({ limit: 8 }));
    }

    Promise.all(promises)
      .then(([t, s, ...rest]) => {
        setTasks(t);
        setSession(s);
        if (isManager && rest.length >= 2) {
          setWorkStats(rest[0] as Awaited<ReturnType<typeof workSessionsService.getDashboardStats>>);
          setRecentFiles(rest[1] as FileRecord[]);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Tam reload sadece ilk açılışta
    // Heartbeat (30sn) session'ı günceller, ayrı interval gerekmez
  }, []);

  const activeSession = session?.activeSession;
  useWorkSessionHeartbeat({
    isSessionActive: !!activeSession,
    isOnBreak,
    onUpdate: load,
    onAutoBreakStart: async () => {
      try { await workSessionsService.startBreak(); setIsOnBreak(true); load(); } catch {}
    },
    onAutoBreakEnd: async () => {
      try { await workSessionsService.endBreak(); setIsOnBreak(false); load(); } catch {}
    },
  });

  const handleAction = async (action: () => Promise<unknown>, onSuccess?: () => void) => {
    setActionLoading(true);
    try { await action(); onSuccess?.(); load(); } finally { setActionLoading(false); }
  };

  const myTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  const activeSec = session?.totals.active ?? 0;
  const idleSec = session?.totals.idle ?? 0;
  const breakSec = session?.totals.break ?? 0;

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isSuperAdmin ? 'Admin Dashboard' : 'Yönetici Dashboard'}</h1>
        <p className="page-subtitle">
          {isSuperAdmin
            ? 'Kendi çalışma takibiniz'
            : 'Şirket genel durumu ve anlık çalışan aktivitesi'}
        </p>
      </div>

      {/* Kendi Sürelerim */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <StatCard title="Bugünkü Aktif Sürem" value={formatDuration(activeSec)} icon={Clock} color="var(--success)" />
        <StatCard title="Boşta Sürem" value={formatDuration(idleSec)} icon={Clock} color="var(--warning)" />
        <StatCard title="Mola Sürem" value={formatDuration(breakSec)} icon={Coffee} color="#8b5cf6" />
        <StatCard title="Aktif Görevim" value={myTasks.length} icon={CheckSquare} />
      </div>

      {/* Çalışma Oturumum */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Card
          title="Çalışma Oturumum"
          subtitle={activeSession ? 'Oturum aktif - süre sayılıyor' : 'Oturum kapalı'}
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
              ? `Başlangıç: ${new Date(activeSession.startedAt).toLocaleTimeString('tr-TR')}`
              : 'Çalışmaya başlamak için butona tıklayın. 3dk hareketsiz kalırsanız otomatik mola.'}
          </p>
        </Card>
      </div>

      {/* İş Yönetici: Çalışan verileri */}
      {isManager && workStats && (
        <>
          <div className="stats-grid">
            <StatCard title="Toplam Çalışan" value={workStats.summary.totalEmployees} icon={Users} />
            <StatCard title="Şu An Çalışan" value={workStats.summary.workingNow} icon={Activity} color="var(--success)" />
            <StatCard title="Aktif" value={workStats.summary.onlineActive} icon={UserCheck} color="var(--success)" />
            <StatCard title="Boşta" value={workStats.summary.onlineIdle} icon={Clock} color="var(--warning)" />
            <StatCard title="Molada" value={workStats.summary.onBreak} icon={Coffee} color="#8b5cf6" />
            <StatCard title="Bugün Ekip Toplam" value={formatDuration(workStats.summary.totalActiveSecondsToday)} icon={Clock} color="#3b82f6" />
            <StatCard title="Bekleyen Görev" value={tasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS').length} icon={CheckSquare} />
            <StatCard title="İnceleme Bekleyen" value={tasks.filter((t) => t.status === 'WAITING_REVIEW').length} icon={FileUp} color="var(--warning)" />
          </div>

          {workStats.employees.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <Card title="Bugünkü Çalışan Aktiflik Karşılaştırması">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={workStats.employees.map((e) => ({
                    name: e.firstName,
                    aktif: Math.round(e.todayActiveSeconds / 60),
                    boşta: Math.round(e.todayIdleSeconds / 60),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} unit="dk" />
                    <Tooltip />
                    <Bar dataKey="aktif" fill="#10b981" name="Aktif (dk)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="boşta" fill="#f59e0b" name="Boşta (dk)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          <div className="grid-2">
            <Card title="Çalışan Kartları">
              <table className="table">
                <thead>
                  <tr>
                    <th>Çalışan</th>
                    <th>Departman</th>
                    <th>Durum</th>
                    <th>Bugün Aktif</th>
                    <th>Görev</th>
                  </tr>
                </thead>
                <tbody>
                  {workStats.employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>{emp.firstName} {emp.lastName}</td>
                      <td>{emp.department?.name ?? '-'}</td>
                      <td>
                        <Badge variant={
                          emp.currentStatus === 'ONLINE_ACTIVE' ? 'success' :
                          emp.currentStatus === 'ONLINE_IDLE' ? 'warning' :
                          emp.currentStatus === 'ON_BREAK' ? 'info' : 'default'
                        }>
                          {STATUS_LABELS[emp.currentStatus] ?? 'Çevrimdışı'}
                        </Badge>
                      </td>
                      <td>{formatDuration(emp.todayActiveSeconds)}</td>
                      <td>{emp.pendingTasks} bekleyen</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card title="Son Görevler">
              <table className="table">
                <thead>
                  <tr>
                    <th>Görev</th>
                    <th>Atanan</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.slice(0, 8).map((task) => (
                    <tr key={task.id}>
                      <td>{task.title}</td>
                      <td>{task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : '-'}</td>
                      <td><Badge>{task.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {recentFiles.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <Card title="Çalışanlardan Gelen Son Dosyalar" subtitle="Son yüklenen dosyalar">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Dosya</th>
                      <th>Yükleyen</th>
                      <th>Boyut</th>
                      <th>Açıklama</th>
                      <th>Tarih</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentFiles.map((file) => (
                      <tr key={file.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={14} style={{ color: 'var(--accent)' }} />
                            {file.originalName}
                          </div>
                        </td>
                        <td>{file.uploadedBy ? `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}` : '-'}</td>
                        <td>{formatFileSize(file.size)}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.description ?? '-'}
                        </td>
                        <td>{formatDateTime(file.createdAt)}</td>
                        <td>
                          <Button size="sm" variant="ghost" onClick={() => filesService.download(file.id, file.originalName)}>
                            <Download size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Sadece Admin: kendi görevleri */}
      {isSuperAdmin && (
        <Card title="Atanmış Görevlerim">
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
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Size atanmış görev bulunmuyor.</td></tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id}>
                    <td style={{ fontWeight: 500 }}>{task.title}</td>
                    <td><Badge variant={task.priority === 'URGENT' || task.priority === 'HIGH' ? 'danger' : 'default'}>{task.priority}</Badge></td>
                    <td>{task.status}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, maxWidth: 80 }}>
                          <div style={{ width: `${task.completionPercent}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: '0.75rem' }}>%{task.completionPercent}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
