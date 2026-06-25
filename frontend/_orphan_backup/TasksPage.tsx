import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { tasksService } from '../services/tasks.service';
import { usersService } from '../services/users.service';
import { useAuth } from '../hooks/useAuth';
import { TASK_STATUS_LABELS, PRIORITY_LABELS, formatDate } from '../utils/format';
import type { Task, User } from '../types';

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

export function TasksPage() {
  const { isManager, isSuperAdmin } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(() => getMonday(new Date()));
  const [searchText, setSearchText] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', priority: 'MEDIUM', assignedToId: '', dueDate: '',
  });

  const load = () => {
    tasksService.getAll().then(setTasks).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (isManager) usersService.getAll().then(setEmployees);
  }, [isManager]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await tasksService.create({
      ...form,
      assignedToId: form.assignedToId || undefined,
      dueDate: form.dueDate || undefined,
    });
    setShowForm(false);
    setForm({ title: '', description: '', priority: 'MEDIUM', assignedToId: '', dueDate: '' });
    load();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await tasksService.updateStatus(id, status);
    load();
  };

  // Haftalık gruplama
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Arama filtresi
  const searched = searchText.trim()
    ? tasks.filter((t) =>
        t.title.toLowerCase().includes(searchText.toLowerCase()) ||
        t.assignedTo?.firstName?.toLowerCase().includes(searchText.toLowerCase()) ||
        t.assignedTo?.lastName?.toLowerCase().includes(searchText.toLowerCase())
      )
    : tasks;

  const weekTasks = weekDays.map((day) => {
    const dayStart = new Date(day);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return {
      date: day,
      label: formatDateTR(day),
      dayName: TR_DAYS[day.getDay() === 0 ? 6 : day.getDay() - 1],
      isToday: day.toDateString() === new Date().toDateString(),
      tasks: searched.filter((t) => {
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

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Görev Yönetimi</h1>
          <p className="page-subtitle">Haftalık görev takibi ve atama</p>
        </div>
        {isManager && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'İptal' : 'Yeni Görev'}
          </Button>
        )}
      </div>

      {showForm && isManager && (
        <Card title="Yeni Görev Oluştur" className="mb-4">
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Başlık</label>
                <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Atanan</label>
                <select className="form-input" value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
                  <option value="">Seçiniz</option>
                  {employees.filter((e) => e.role === 'EMPLOYEE').map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Öncelik</label>
                <select className="form-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Son Tarih</label>
                <input type="date" className="form-input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Açıklama</label>
              <textarea className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <Button type="submit">Oluştur</Button>
          </form>
        </Card>
      )}

      {/* Hafta navigasyonu */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
          {isSuperAdmin ? 'Tüm Görevler' : 'Ekip Görevleri'}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button size="sm" variant="ghost" onClick={prevWeek}>&larr;</Button>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, minWidth: 180, textAlign: 'center' }}>
            {formatDateTR(weekDays[0])} - {formatDateTR(weekDays[6])}
          </span>
          <Button size="sm" variant="ghost" onClick={nextWeek}>&rarr;</Button>
        </div>
      </div>

      {/* Arama */}
      <div style={{ marginBottom: '1rem', position: 'relative' }}>
        <input
          className="form-input"
          style={{ paddingLeft: '2rem' }}
          placeholder="Görev adı veya çalışan ara..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          🔍
        </span>
      </div>

      {/* Haftalık görev listesi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {weekTasks.map((day) => (
          <div key={day.date.toISOString()} style={{
            border: `1px solid ${day.isToday ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            background: 'var(--bg-secondary)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.6rem 1rem',
              background: day.isToday ? 'var(--accent)' : 'var(--bg-primary)',
              color: day.isToday ? 'white' : 'var(--text-primary)',
              fontWeight: 600, fontSize: '0.85rem',
            }}>
              <span>{day.dayName} {day.label}</span>
              <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>{day.tasks.length} görev</span>
            </div>

            {day.tasks.length === 0 ? (
              <div style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Bu güne ait görev bulunmuyor.
              </div>
            ) : (
              <table className="table" style={{ margin: 0 }}>
                <tbody>
                  {day.tasks.map((task) => (
                    <tr key={task.id}>
                      <td style={{ width: '40%' }}>
                        <Link to={`/tasks/${task.id}`} style={{ color: 'var(--accent)', fontWeight: 500, fontSize: '0.85rem' }}>
                          {task.title}
                        </Link>
                      </td>
                      <td>
                        <Badge variant={task.priority === 'URGENT' || task.priority === 'HIGH' ? 'danger' : 'default'}>
                          {PRIORITY_LABELS[task.priority]}
                        </Badge>
                      </td>
                      <td>{TASK_STATUS_LABELS[task.status]}</td>
                      <td>{task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {task.status === 'TODO' && (
                            <Button size="sm" variant="ghost" onClick={() => handleStatusChange(task.id, 'IN_PROGRESS')}>
                              Başla
                            </Button>
                          )}
                          {task.status === 'IN_PROGRESS' && (
                            <Button size="sm" variant="ghost" onClick={() => handleStatusChange(task.id, 'COMPLETED')}>
                              Tamamla
                            </Button>
                          )}
                          <Link to={`/tasks/${task.id}`}>
                            <Button size="sm" variant="ghost">Detay</Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
