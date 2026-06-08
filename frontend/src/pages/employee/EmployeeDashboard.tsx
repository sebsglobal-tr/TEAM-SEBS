import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Coffee, Play, Square, FileText, Upload,
  ListTodo, CheckSquare, BarChart3, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { workSessionsService } from '../../services/work-sessions.service';
import { filesService, type FileRecord } from '../../services/files.service';
import { tasksService } from '../../services/tasks.service';
import { api } from '../../services/api';
import { DailyTaskView } from '../../components/DailyTaskView';
import { useWorkSessionHeartbeat } from '../../hooks/useWorkSessionHeartbeat';
import { formatDuration } from '../../utils/format';
import type { WorkSessionToday, Task } from '../../types';

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
  const navigate = useNavigate();
  const [session, setSession] = useState<WorkSessionToday | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentFiles, setRecentFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(() => getMonday(new Date()));
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTaskRef = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [s, t, f] = await Promise.all([
        workSessionsService.getToday(),
        tasksService.getAll({ limit: "20" }),
        filesService.getAll({ limit: 5 }),
      ]);
      setSession(s);
      setTasks(t);
      setRecentFiles(f);
    } catch (err) {
      console.error('Veri yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const activeSession = session?.activeSession;
  useWorkSessionHeartbeat({
    isSessionActive: !!activeSession,
    isOnBreak,
    onUpdate: loadData,
  });

  const handleAction = async (action: () => Promise<unknown>, onSuccess?: () => void) => {
    setActionLoading(true);
    try { await action(); onSuccess?.(); loadData(); } finally { setActionLoading(false); }
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      await tasksService.updateStatus(taskId, status);
      const updated = await tasksService.getAll({ limit: "20" });
      setTasks(updated);
    } catch (err) {
      console.error('Görev durumu güncellenirken hata:', err);
    }
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

  const formatHHMMSS = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      {/* ─── ÜST: Saat + Oturum ─── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">Ana Sayfa</h1>
          <p className="page-subtitle">Günlük görev takviminiz ve çalışma takibiniz</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Timer control */}
          {!activeSession ? (
            <button className="btn btn-primary btn-sm" onClick={() => handleAction(() => workSessionsService.start())} disabled={actionLoading}>
              <Play size={14} /> Başla
            </button>
          ) : (
            <>
              {!isOnBreak ? (
                <button className="btn btn-secondary btn-sm" onClick={() => handleAction(() => workSessionsService.startBreak(), () => setIsOnBreak(true))} disabled={actionLoading}>
                  <Coffee size={14} /> Mola
                </button>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => handleAction(() => workSessionsService.endBreak(), () => setIsOnBreak(false))} disabled={actionLoading}>
                  Mola Bitir
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={() => handleAction(() => workSessionsService.stop(), () => setIsOnBreak(false))} disabled={actionLoading}>
                <Square size={14} /> Bitir
              </button>
            </>
          )}
        </div>
      </div>

      {/* Süre kartları */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/timer')}>
          <div className="stat-card-icon employee" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <Clock size={20} />
          </div>
          <div>
            <div className="stat-card-label">Bugün Aktif</div>
            <div className="stat-card-value">{formatDuration(session?.totals.active ?? 0)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon employee" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            <Clock size={20} />
          </div>
          <div>
            <div className="stat-card-label">Mola</div>
            <div className="stat-card-value">{formatDuration(session?.totals.break ?? 0)}</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/reports')}>
          <div className="stat-card-icon employee"><FileText size={20} /></div>
          <div>
            <div className="stat-card-label">Raporlarım</div>
            <div className="stat-card-value">{tasks.length} görev</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/upload-report')}>
          <div className="stat-card-icon employee"><Upload size={20} /></div>
          <div>
            <div className="stat-card-label">Rapor Yükle</div>
            <div className="stat-card-value" style={{ fontSize: '0.85rem' }}>Hemen başla</div>
          </div>
        </div>
      </div>

      {/* ─── GÜNLÜK GÖREV TAKVİMİ ─── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ListTodo size={18} /> Günlük Görev Takvimi
            </div>
            <div className="card-subtitle">Görevlerinizin akış içinde takibi</div>
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: '0.5rem' }}>
          <DailyTaskView
            tasks={tasks}
            onStatusChange={handleStatusChange}
            onViewDetail={(id) => navigate(`/tasks/${id}`)}
            onUploadFile={triggerFileUpload}
          />
          <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload} />
        </div>
      </div>

      {/* ─── HAFTALIK GÖREV TAKVİMİ (mini) ─── */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Haftalık Görünüm</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, minWidth: 180, textAlign: 'center' }}>
            {formatDateTR(weekDays[0])} - {formatDateTR(weekDays[6])}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {weekTasks.map((day) => (
          <div
            key={day.date.toISOString()}
            style={{
              border: `1px solid ${day.isToday ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              background: day.isToday ? 'rgba(5,150,105,0.04)' : 'var(--bg-secondary)',
              overflow: 'hidden',
            }}
          >
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
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: task.status === 'COMPLETED' ? 'var(--success)' :
                                  task.status === 'IN_PROGRESS' ? 'var(--accent)' :
                                  task.status === 'WAITING_REVIEW' ? 'var(--warning)' :
                                  task.status === 'CANCELLED' ? 'var(--danger)' : 'var(--border)',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{task.title}</div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.15rem' }}>
                        <span className={`badge ${task.priority === 'URGENT' || task.priority === 'HIGH' ? 'badge-danger' : 'badge-default'}`}>
                          {task.priority}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          %{task.completionPercent}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ─── SON DOSYALARIM ─── */}
      {recentFiles.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Son Yüklediğim Dosyalar</div>
          </div>
          <div className="card-body">
            {recentFiles.map((file) => (
              <div key={file.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '0.85rem' }}>{file.originalName}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{formatFileSize(file.size)}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => filesService.download(file.id, file.originalName)}>
                  İndir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
