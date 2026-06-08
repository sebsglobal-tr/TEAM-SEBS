import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { CheckSquare, Clock, Coffee, Play, Square, Upload, Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { tasksService } from '../services/tasks.service';
import { workSessionsService } from '../services/work-sessions.service';
import { filesService, type FileRecord } from '../services/files.service';
import { useWorkSessionHeartbeat } from '../hooks/useWorkSessionHeartbeat';
import { formatDuration, TASK_STATUS_LABELS } from '../utils/format';
import type { Task, WorkSessionToday } from '../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TR_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateTR(d: Date): string {
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

export function EmployeeDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [session, setSession] = useState<WorkSessionToday | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(() => getMonday(new Date()));
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTaskRef = useRef<string | null>(null);

  const loadData = useCallback(() => {
    Promise.all([
      tasksService.getAll(),
      workSessionsService.getToday(),
      filesService.getAll({ limit: 5 }),
    ])
      .then(([t, s, f]) => { setTasks(t); setSession(s); setRecentFiles(f); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const activeSession = session?.activeSession;
  useWorkSessionHeartbeat({
    isSessionActive: !!activeSession,
    isOnBreak,
    onUpdate: loadData,
    onAutoBreakStart: async () => {
      try { await workSessionsService.startBreak(); setIsOnBreak(true); loadData(); } catch {}
    },
    onAutoBreakEnd: async () => {
      try { await workSessionsService.endBreak(); setIsOnBreak(false); loadData(); } catch {}
    },
  });

  const handleAction = async (action: () => Promise<unknown>, onSuccess?: () => void) => {
    setActionLoading(true);
    try { await action(); onSuccess?.(); loadData(); } finally { setActionLoading(false); }
  };

  // ── Haftalık görev gruplaması ──
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekTasks = weekDays.map((day) => {
    const dayStart = new Date(day);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    return {
      date: day,
      label: formatDateTR(day),
      dayName: TR_DAYS[day.getDay() === 0 ? 6 : day.getDay() - 1],
      isToday: day.toDateString() === new Date().toDateString(),
      tasks: tasks.filter((t) => {
        const d = t.dueDate ? new Date(t.dueDate) : new Date(t.createdAt);
        return d >= dayStart && d <= dayEnd;
      }),
    };
  });

  const prevWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(d);
  };
  const nextWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(d);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const taskId = pendingTaskRef.current;
    if (!file || !taskId) return;
    setUploadingTask(taskId);
    try {
      await filesService.upload(file, { taskId, fileType: 'TASK_ATTACHMENT', description: file.name });
      loadData();
    } finally {
      setUploadingTask(null);
      pendingTaskRef.current = null;
      if (e.target) e.target.value = '';
    }
  };

  const triggerFileUpload = (taskId: string) => {
    pendingTaskRef.current = taskId;
    fileInputRef.current?.click();
  };

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div>
      {/* ── ÜST: Oturum + Süreler ── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Ana Sayfa</h1>
          <p className="page-subtitle">Haftalık görev takibiniz</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
      </div>

      {/* Süre kartları */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <StatCard title="Bugün Aktif" value={formatDuration(session?.totals.active ?? 0)} icon={Clock} color="var(--success)" />
        <StatCard title="Boşta" value={formatDuration(session?.totals.idle ?? 0)} icon={Clock} color="var(--warning)" />
        <StatCard title="Mola" value={formatDuration(session?.totals.break ?? 0)} icon={Coffee} color="#8b5cf6" />
        <StatCard title="Toplam Görev" value={tasks.length} icon={CheckSquare} />
      </div>

      {/* ── HAFTALIK GÖREV TAKVİMİ ── */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Haftalık Görevler</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button size="sm" variant="ghost" onClick={prevWeek}><ChevronLeft size={16} /></Button>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, minWidth: 180, textAlign: 'center' }}>
            {formatDateTR(weekDays[0])} - {formatDateTR(weekDays[6])}
          </span>
          <Button size="sm" variant="ghost" onClick={nextWeek}><ChevronRight size={16} /></Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {weekTasks.map((day) => (
          <div
            key={day.date.toISOString()}
            style={{
              border: `1px solid ${day.isToday ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              background: day.isToday ? 'rgba(59,130,246,0.03)' : 'var(--bg-secondary)',
              overflow: 'hidden',
            }}
          >
            {/* Gün başlığı */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 1rem',
                background: day.isToday ? 'var(--accent)' : 'var(--bg-primary)',
                color: day.isToday ? 'white' : 'var(--text-primary)',
                fontWeight: 600, fontSize: '0.85rem',
              }}
            >
              <span>{day.dayName} {day.label}</span>
              <span style={{ opacity: day.isToday ? 0.9 : 0.6, fontSize: '0.8rem' }}>
                {day.tasks.length} görev
              </span>
            </div>

            {/* Görev listesi */}
            {day.tasks.length === 0 ? (
              <div style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Bu güne ait görev bulunmuyor.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {day.tasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.6rem 1rem',
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    {/* Durum göstergesi */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: task.status === 'COMPLETED' ? 'var(--success)' :
                                  task.status === 'IN_PROGRESS' ? 'var(--accent)' :
                                  task.status === 'WAITING_REVIEW' ? 'var(--warning)' :
                                  task.status === 'CANCELLED' ? 'var(--danger)' : 'var(--border)',
                    }} />

                    {/* Görev bilgisi */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.title}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.15rem' }}>
                        <Badge variant={task.priority === 'URGENT' || task.priority === 'HIGH' ? 'danger' : 'default'} style={{ fontSize: '0.6rem' }}>
                          {task.priority}
                        </Badge>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {TASK_STATUS_LABELS[task.status]} · %{task.completionPercent}
                        </span>
                      </div>
                    </div>

                    {/* Dosya yükleme */}
                    <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload} />
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={uploadingTask === task.id}
                      onClick={() => triggerFileUpload(task.id)}
                    >
                      <Upload size={14} />
                    </Button>

                    {/* Detay linki */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.location.href = `/tasks/${task.id}`}
                    >
                      <FileText size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── SON DOSYALARIM (küçük) ── */}
      {recentFiles.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <Card title="Son Yüklediğim Dosyalar">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {recentFiles.map((file) => (
                <div key={file.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.4rem 0.75rem', background: 'var(--bg-primary)', borderRadius: '6px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                    <FileText size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.originalName}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => filesService.download(file.id, file.originalName)}>
                    <Download size={12} />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: {
  title: string; value: string | number; icon: React.ComponentType<{ size?: number }>; color?: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 'var(--radius)',
      padding: '1rem', border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${color ?? 'var(--accent)'}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color ?? 'var(--accent)',
      }}>
        <Icon size={20} />
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{title}</div>
        <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  );
}
