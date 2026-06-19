import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, CheckCircle, AlertCircle, Upload, FileText, X } from 'lucide-react';
import { tasksService } from '../../services/tasks.service';
import { usersService, type EmployeeUser } from '../../services/users.service';
import { filesService } from '../../services/files.service';
import { useEffect } from 'react';

interface TaskEntry {
  key: string;
  title: string;
  description: string;
  taskType: string;
  priority: string;
  dueDate: string;
  estimatedMinutes: string;
  responsibleManagerId: string;
  files: File[];
}

const TASK_TYPES = [
  { value: 'SOFTWARE', label: 'Yazılım' },
  { value: 'DESIGN', label: 'Tasarım' },
  { value: 'CONTENT', label: 'İçerik' },
  { value: 'TEST', label: 'Test' },
  { value: 'OPERATION', label: 'Operasyon' },
  { value: 'MARKETING', label: 'Pazarlama' },
  { value: 'OTHER', label: 'Diğer' },
];

const PRIORITIES = [
  { value: 'LOW', label: 'Düşük', color: '#10b981' },
  { value: 'MEDIUM', label: 'Orta', color: '#3b82f6' },
  { value: 'HIGH', label: 'Yüksek', color: '#f59e0b' },
  { value: 'URGENT', label: 'Kritik', color: '#ef4444' },
];

function emptyTask(): TaskEntry {
  return {
    key: Math.random().toString(36).substring(7),
    title: '',
    description: '',
    taskType: 'OTHER',
    priority: 'MEDIUM',
    dueDate: '',
    estimatedMinutes: '',
    responsibleManagerId: '',
    files: [],
  };
}

export function AdminBulkCreate() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskEntry[]>([emptyTask()]);
  const [managers, setManagers] = useState<EmployeeUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count: number; message: string } | null>(null);

  useEffect(() => {
    usersService.getAll({ status: 'ACTIVE' })
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        setManagers(all.filter((u: any) => u.role === 'MANAGER'));
      })
      .catch(console.error);
  }, []);

  const addTask = () => setTasks((prev) => [...prev, emptyTask()]);

  const removeTask = (key: string) => {
    if (tasks.length <= 1) return;
    setTasks((prev) => prev.filter((t) => t.key !== key));
  };

  const updateTask = (key: string, field: keyof TaskEntry, value: any) => {
    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, [field]: value } : t)));
  };

  const addFileToTask = (key: string, file: File) => {
    setTasks((prev) => prev.map((t) => {
      if (t.key !== key) return t;
      const exists = t.files.some((f) => f.name === file.name && f.size === file.size);
      if (exists) return t;
      return { ...t, files: [...t.files, file] };
    }));
  };

  const removeFileFromTask = (key: string, index: number) => {
    setTasks((prev) => prev.map((t) => {
      if (t.key !== key) return t;
      return { ...t, files: t.files.filter((_, i) => i !== index) };
    }));
  };

  const validTasks = tasks.filter((t) => t.title.trim().length > 0);

  const handleSubmit = async () => {
    if (validTasks.length === 0) {
      setResult({ success: false, count: 0, message: 'En az bir görev başlığı girin.' });
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    let errorMessages: string[] = [];

    try {
      for (const entry of validTasks) {
        const payload: any = {
          title: entry.title.trim(),
          description: entry.description.trim() || undefined,
          taskType: entry.taskType,
          priority: entry.priority,
          dueDate: entry.dueDate || undefined,
          estimatedMinutes: entry.estimatedMinutes ? parseInt(entry.estimatedMinutes, 10) : undefined,
          responsibleManagerId: entry.responsibleManagerId || undefined,
        };

        try {
          const createdTask: any = await tasksService.create(payload);
          successCount++;

          // Upload files if any
          if (entry.files.length > 0 && createdTask?.id) {
            for (const file of entry.files) {
              try {
                const uploaded = await filesService.upload(file, {
                  taskId: createdTask.id,
                  fileType: 'TASK_ATTACHMENT',
                  description: `${entry.title} görev dosyası`,
                });
                // Register with task so it appears in task.files (TaskFile)
                await tasksService.addFile(createdTask.id, {
                  fileName: uploaded.originalName,
                  fileUrl: `/api/files/${uploaded.id}/download`,
                  fileType: uploaded.mimeType,
                  fileSize: uploaded.size,
                });
              } catch (fileErr: any) {
                errorMessages.push(`"${entry.title}" dosyası yüklenemedi: ${fileErr?.response?.data?.message || 'Bilinmeyen hata'}`);
              }
            }
          }
        } catch (taskErr: any) {
          errorMessages.push(`"${entry.title}" oluşturulamadı: ${taskErr?.response?.data?.message || 'Bilinmeyen hata'}`);
        }
      }

      setResult({
        success: successCount > 0,
        count: successCount,
        message: errorMessages.length > 0
          ? `${successCount} görev başarıyla oluşturuldu! ${errorMessages.length} hata: ${errorMessages.join(', ')}`
          : `${successCount} görev başarıyla oluşturuldu!`,
      });

      if (successCount > 0) {
        setTasks([emptyTask()]);
      }
    } catch (err: any) {
      setResult({
        success: false,
        count: 0,
        message: err?.response?.data?.message || 'Görevler oluşturulurken hata oluştu.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Toplu Görev Ekle</h1>
          <p className="page-subtitle">Aynı anda birden fazla görev oluşturun. Her göreve dosya ekleyebilirsiniz.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/admin/tasks')}>
          <ArrowLeft size={16} /> Görevlere Dön
        </button>
      </div>

      {result && (
        <div className={`alert-banner ${result.success ? 'alert-success' : 'alert-error'}`}>
          {result.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {result.message}
        </div>
      )}

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {tasks.map((task, index) => (
          <div key={task.key} className="card card-animate">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: 'var(--accent-light)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700,
                }}>{index + 1}</span>
                Görev {index + 1}
                {task.files.length > 0 && (
                  <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                    {task.files.length} dosya
                  </span>
                )}
              </div>
              {tasks.length > 1 && (
                <button className="btn btn-ghost btn-sm" onClick={() => removeTask(task.key)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="card-body">
              <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Görev Başlığı *</label>
                  <input
                    className="form-input"
                    placeholder="Örn: SEBS çalışan paneli kullanıcı yetki ekranı tasarımı"
                    value={task.title}
                    onChange={(e) => updateTask(task.key, 'title', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Açıklama</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Ne yapılacağı hakkında detay..."
                  value={task.description}
                  onChange={(e) => updateTask(task.key, 'description', e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Görev Türü</label>
                  <select
                    className="form-select"
                    value={task.taskType}
                    onChange={(e) => updateTask(task.key, 'taskType', e.target.value)}
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Öncelik</label>
                  <select
                    className="form-select"
                    value={task.priority}
                    onChange={(e) => updateTask(task.key, 'priority', e.target.value)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Teslim Tarihi</label>
                  <input
                    type="date"
                    className="form-input"
                    value={task.dueDate}
                    onChange={(e) => updateTask(task.key, 'dueDate', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tahmini Süre (dk)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Opsiyonel"
                    value={task.estimatedMinutes}
                    onChange={(e) => updateTask(task.key, 'estimatedMinutes', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Atanacak Yönetici</label>
                <select
                  className="form-select"
                  value={task.responsibleManagerId}
                  onChange={(e) => updateTask(task.key, 'responsibleManagerId', e.target.value)}
                >
                  <option value="">— Havuza Ekle (Atama Yapma) —</option>
                  {managers.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                  ))}
                </select>
              </div>

              {/* ─── File Upload ─── */}
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label className="form-label">Dosya Ekle</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    <Upload size={14} /> Dosya Seç
                    <input
                      type="file"
                      hidden
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          Array.from(e.target.files).forEach((f) => addFileToTask(task.key, f));
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {task.files.length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {task.files.map((file, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.3rem 0.6rem', background: 'var(--bg-primary)',
                        borderRadius: 6, fontSize: '0.78rem',
                      }}>
                        <FileText size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 4px' }} onClick={() => removeFileFromTask(task.key, i)}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={addTask}>
          <Plus size={16} /> Görev Ekle
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting || validTasks.length === 0}
          style={{ marginLeft: 'auto' }}
        >
          <Save size={16} />
          {submitting ? 'Kaydediliyor...' : `${validTasks.length} Görevi Kaydet`}
        </button>
      </div>
    </div>
  );
}
