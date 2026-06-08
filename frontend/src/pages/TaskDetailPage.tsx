import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Send, Check, RotateCcw } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { tasksService } from '../services/tasks.service';
import { filesService } from '../services/files.service';
import { useAuth } from '../hooks/useAuth';
import {
  TASK_STATUS_LABELS,
  PRIORITY_LABELS,
  formatDate,
  formatDateTime,
} from '../utils/format';
import type { Task } from '../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isManager } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    if (!id) return;
    tasksService.getById(id).then(setTask).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const isAssignee = task?.assignedToId === user?.id;

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !comment.trim()) return;
    setSubmitting(true);
    try {
      await tasksService.addComment(id, comment.trim());
      setComment('');
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    try {
      await filesService.upload(file, { taskId: id, fileType: 'TASK_ATTACHMENT' });
      load();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStatus = async (status: string, note?: string) => {
    if (!id) return;
    setSubmitting(true);
    try {
      await tasksService.updateStatus(id, status, note);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Yükleniyor...</div>;
  if (!task) return <div>Görev bulunamadı</div>;

  return (
    <div>
      <button
        onClick={() => navigate('/tasks')}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', marginBottom: '1rem', cursor: 'pointer' }}
      >
        <ArrowLeft size={16} /> Görevlere Dön
      </button>

      <div className="page-header">
        <h1 className="page-title">{task.title}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <Badge variant={task.priority === 'URGENT' ? 'danger' : 'info'}>
            {PRIORITY_LABELS[task.priority]}
          </Badge>
          <Badge variant={task.status === 'COMPLETED' ? 'success' : 'default'}>
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            İlerleme: %{task.completionPercent}
          </span>
        </div>
      </div>

      <div className="grid-2">
        <Card title="Görev Detayı">
          {task.description && (
            <p style={{ marginBottom: '1rem', lineHeight: 1.6 }}>{task.description}</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
            <div><strong>Atanan:</strong> {task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : '-'}</div>
            <div><strong>Oluşturan:</strong> {task.createdBy ? `${task.createdBy.firstName} ${task.createdBy.lastName}` : '-'}</div>
            <div><strong>Departman:</strong> {task.department?.name ?? '-'}</div>
            <div><strong>Son Tarih:</strong> {task.dueDate ? formatDate(task.dueDate) : '-'}</div>
            <div><strong>Tahmini:</strong> {task.estimatedMinutes ? `${task.estimatedMinutes} dk` : '-'}</div>
            <div><strong>Gerçekleşen:</strong> {task.actualMinutes} dk</div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {isAssignee && task.status === 'TODO' && (
              <Button size="sm" onClick={() => handleStatus('IN_PROGRESS')} loading={submitting}>
                Göreve Başla
              </Button>
            )}
            {isAssignee && task.status === 'IN_PROGRESS' && (
              <Button size="sm" onClick={() => handleStatus('COMPLETED')} loading={submitting}>
                <Check size={14} /> İncelemeye Gönder
              </Button>
            )}
            {isManager && task.status === 'WAITING_REVIEW' && (
              <>
                <Button size="sm" onClick={() => handleStatus('COMPLETED')} loading={submitting}>
                  <Check size={14} /> Onayla
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleStatus('IN_PROGRESS', revisionNote || 'Revize gerekli')} loading={submitting}>
                  <RotateCcw size={14} /> Revize İste
                </Button>
              </>
            )}
          </div>
          {isManager && task.status === 'WAITING_REVIEW' && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <input
                className="form-input"
                placeholder="Revize notu (opsiyonel)"
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
              />
            </div>
          )}
        </Card>

        <Card
          title="Dosya Ekleri"
          action={
            <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploading}>
              <Upload size={14} /> Yükle
            </Button>
          }
        >
          <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload} />
          {task.attachments?.length ? (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {task.attachments.map((att) => (
                <li
                  key={att.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: '8px' }}
                >
                  <span style={{ fontSize: '0.9rem' }}>{att.file?.originalName}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {att.file ? formatFileSize(att.file.size) : ''}
                    </span>
                    {att.file && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => filesService.download(att.file!.id, att.file!.originalName)}
                      >
                        İndir
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Henüz dosya eklenmemiş</p>
          )}
        </Card>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <Card title="Yorumlar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {task.comments?.length ? (
              task.comments.map((c) => (
                <div key={c.id} style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <strong style={{ fontSize: '0.85rem' }}>
                      {c.user ? `${c.user.firstName} ${c.user.lastName}` : 'Kullanıcı'}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {formatDateTime(c.createdAt)}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.9rem' }}>{c.comment}</p>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Henüz yorum yok</p>
            )}
          </div>

          <form onSubmit={handleComment} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className="form-input"
              placeholder="Yorum yazın..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button type="submit" loading={submitting}>
              <Send size={14} />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
