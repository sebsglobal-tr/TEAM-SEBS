import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Building2, BadgeCheck, Briefcase,
  Clock, FileText, Download, CheckSquare,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { usersService } from '../services/users.service';
import { filesService } from '../services/files.service';
import { formatDuration, formatDateTime, ROLE_LABELS, STATUS_LABELS, TASK_STATUS_LABELS } from '../utils/format';
import type { User } from '../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    usersService
      .getById(id)
      .then(setUser)
      .catch((err) => setError(err?.response?.data?.message ?? 'Kullanıcı bulunamadı'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div>Yükleniyor...</div>;
  if (error || !user) {
    return (
      <div>
        <div className="page-header">
          <Link to="/employees" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>
            <ArrowLeft size={16} /> Çalışanlara Dön
          </Link>
          <h1 className="page-title">Çalışan Bulunamadı</h1>
          <p className="page-subtitle">{error ?? 'Kullanıcı bilgisine erişilemiyor.'}</p>
        </div>
      </div>
    );
  }

  const displayName = `${user.firstName} ${user.lastName}`;
  const sessions = user.workSessions ?? [];

  return (
    <div>
      {/* Back button */}
      <Link to="/employees" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', fontSize: '0.9rem', marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Çalışanlara Dön
      </Link>

      {/* Profile Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 700, color: 'white', flexShrink: 0,
          }}
        >
          {user.firstName[0]}{user.lastName[0]}
        </div>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{displayName}</h1>
          <p className="page-subtitle" style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span>{user.position ?? ROLE_LABELS[user.role]}</span>
            <Badge variant={user.status === 'ACTIVE' ? 'success' : 'danger'}>
              {user.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
            </Badge>
            <Badge variant={
              user.currentStatus === 'ONLINE_ACTIVE' ? 'success' :
              user.currentStatus === 'ONLINE_IDLE' ? 'warning' :
              user.currentStatus === 'ON_BREAK' ? 'info' : 'default'
            }>
              {STATUS_LABELS[user.currentStatus ?? 'OFFLINE']}
            </Badge>
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <Card title="Departman" subtitle={user.department?.name ?? 'Atanmamış'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <Building2 size={16} />
            <span>{user.department?.description ?? '-'}</span>
          </div>
        </Card>
        <Card title="İletişim">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <Mail size={16} />
            <a href={`mailto:${user.email}`} style={{ color: 'var(--accent)' }}>{user.email}</a>
          </div>
        </Card>
        <Card title="Rol">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <Briefcase size={16} />
            <span>{ROLE_LABELS[user.role]}</span>
          </div>
        </Card>
        <Card title="Son Aktif">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <BadgeCheck size={16} />
            <span>{user.lastActiveAt ? formatDateTime(user.lastActiveAt) : 'Kayıt yok'}</span>
          </div>
        </Card>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Work Sessions */}
        <Card title="Çalışma Süreleri" subtitle="Son 10 oturum">
          {sessions.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Henüz çalışma oturumu kaydı yok.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Başlangıç</th>
                  <th>Aktif</th>
                  <th>Boşta</th>
                  <th>Mola</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontSize: '0.85rem' }}>{formatDateTime(s.startedAt)}</td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDuration(s.totalActiveSeconds)}</td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDuration(s.totalIdleSeconds)}</td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDuration(s.totalBreakSeconds)}</td>
                    <td>
                      <Badge variant={s.status === 'ENDED' ? 'default' : 'success'}>
                        {s.status === 'ENDED' ? 'Bitti' : s.status === 'ACTIVE' ? 'Aktif' : 'Duraklatıldı'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Uploaded Files */}
        <Card title="Yüklediği Dosyalar" subtitle="Son 10 dosya">
          {(user.uploadedFiles ?? []).length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Henüz dosya yüklememiş.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(user.uploadedFiles ?? []).map((file) => (
                <div
                  key={file.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem', background: 'var(--bg-primary)',
                    borderRadius: '8px', gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    <FileText size={16} style={{ flexShrink: 0, color: 'var(--accent)' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.originalName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {formatFileSize(file.size)} • {formatDateTime(file.createdAt)}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => filesService.download(file.id, file.originalName)}>
                    <Download size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Assigned Tasks */}
      <Card title="Atanmış Görevler" subtitle="Son 10 görev">
        {(user.assignedTasks ?? []).length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Henüz görev atanmamış.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Görev</th>
                <th>Öncelik</th>
                <th>Durum</th>
                <th>İlerleme</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {(user.assignedTasks ?? []).map((task) => (
                <tr key={task.id}>
                  <td>
                    <Link to={`/tasks/${task.id}`} style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
                      {task.title}
                    </Link>
                  </td>
                  <td>
                    <Badge variant={task.priority === 'URGENT' ? 'danger' : task.priority === 'HIGH' ? 'warning' : 'default'}>
                      {task.priority}
                    </Badge>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{TASK_STATUS_LABELS[task.status]}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, maxWidth: 100 }}>
                        <div style={{ width: `${task.completionPercent}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>%{task.completionPercent}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{formatDateTime(task.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
