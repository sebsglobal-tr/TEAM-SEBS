import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { tasksService } from '../../services/tasks.service';
import { usersService, type EmployeeUser } from '../../services/users.service';
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

  const updateTask = (key: string, field: keyof TaskEntry, value: string) => {
    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, [field]: value } : t)));
  };

  const validTasks = tasks.filter((t) => t.title.trim().length > 0);

  const handleSubmit = async () => {
    if (validTasks.length === 0) {
      setResult({ success: false, count: 0, message: 'En az bir görev başlığı girin.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = validTasks.map((t) => ({
        title: t.title.trim(),
        description: t.description.trim() || undefined,
        taskType: t.taskType,
        priority: t.priority,
        dueDate: t.dueDate || undefined,
        estimatedMinutes: t.estimatedMinutes ? parseInt(t.estimatedMinutes, 10) : undefined,
        responsibleManagerId: t.responsibleManagerId || undefined,
      }));

      const res = await tasksService.createBulk(payload);
      setResult({
        success: true,
        count: res.count,
        message: `${res.count} görev başarıyla oluşturuldu!`,
      });
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
          <p className="page-subtitle">Aynı anda birden fazla görev oluşturun. Görevler havuza eklenir veya yöneticilere atanır.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/admin/tasks')}>
          <ArrowLeft size={16} /> Görevlere Dön
        </button>
      </div>

      {result && (
        <div style={{
          padding: '1rem',
          borderRadius: 10,
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
          fontWeight: 500,
          background: result.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: result.success ? '#10b981' : '#ef4444',
          border: `1px solid ${result.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          {result.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {result.message}
        </div>
      )}

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {tasks.map((task, index) => (
          <div key={task.key} className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: 'var(--accent-light)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700,
                }}>{index + 1}</span>
                Görev {index + 1}
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
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Boş bırakılırsa görev genel havuza eklenir. Yönetici seçilirse doğrudan atanır.
                </div>
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
