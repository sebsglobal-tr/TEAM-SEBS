import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Calendar, Clock, Flag, FileText, Download,
  MessageSquare, CheckCircle, RotateCcw, Send, AlertCircle,
  Upload, Paperclip, ExternalLink,
} from 'lucide-react';
import { tasksService } from '../../services/tasks.service';
import { filesService } from '../../services/files.service';
import { formatDate, formatDateTime } from '../../utils/format';
import type { Task } from '../../types';

const STATUS_LABELS: Record<string, string> = {
  POOL: 'Havuzda', ASSIGNED_TO_MANAGER: 'Yöneticiye Atandı',
  ASSIGNED_TO_EMPLOYEE: 'Çalışana Atandı', PENDING: 'Beklemede',
  IN_PROGRESS: 'Devam Ediyor', PARTIALLY_COMPLETED: 'Kısmen Tamamlandı',
  BLOCKED: 'Blokaj Var', SUBMITTED: 'İncelemede',
  REVISION_REQUESTED: 'Revize İstendi', MANAGER_APPROVED: 'Onaylandı',
  ADMIN_APPROVED: 'Admin Onaylı', CANCELLED: 'İptal',
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#3b82f6', LOW: '#6b7280',
};

export function ManagerTaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [revisionNote, setRevisionNote] = useState('');

  // Download state
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');

  const load = () => {
    if (!id) return;
    setLoading(true);
    tasksService.getById(id).then(setTask).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleStatus = async (status: string, note?: string) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await tasksService.updateStatus(id, status, note || '');
      load();
    } finally {
      setActionLoading(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !comment.trim()) return;
    setActionLoading(true);
    try {
      await tasksService.addComment(id, comment.trim(), 'NORMAL');
      setComment('');
      load();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadFile = async (file: any) => {
    if (file.fileType === 'link') { window.open(file.fileUrl, '_blank', 'noopener'); return; }
    setDownloadError('');
    setDownloadingFileId(file.id);
    try {
      await filesService.download(file.fileUrl, file.fileName);
    } catch (err: any) {
      const status = err?.response?.status;
      let msg = 'Dosya indirilirken hata oluştu';
      if (status === 403) msg = 'Bu dosyaya erişim yetkiniz yok';
      else if (status === 404) msg = 'Dosya bulunamadı veya silinmiş';
      else if (err?.response?.data?.message) msg = err.response.data.message;
      setDownloadError(msg);
      setTimeout(() => setDownloadError(''), 5000);
    } finally {
      setDownloadingFileId(null);
    }
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;
  if (!task) return <div className="empty-state">Görev bulunamadı.</div>;

  const canAct = task.status === 'SUBMITTED' || task.status === 'IN_PROGRESS';
  const canApprove = task.status === 'SUBMITTED';
  const canRequestRevision = task.status === 'SUBMITTED' || task.status === 'IN_PROGRESS';

  return (
    <div>
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Geri
      </button>

      {/* Başlık */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{task.title}</h2>
            <span className={`badge ${task.status === 'MANAGER_APPROVED' || task.status === 'ADMIN_APPROVED' ? 'badge-success' : task.status === 'BLOCKED' || task.status === 'REVISION_REQUESTED' ? 'badge-danger' : task.status === 'SUBMITTED' ? 'badge-warning' : task.status === 'IN_PROGRESS' ? 'badge-info' : 'badge-default'}`}>
              {STATUS_LABELS[task.status] ?? task.status}
            </span>
          </div>
          {task.description && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
              {task.description}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {task.assignedTo && (
              <span><User size={13} style={{ display: 'inline', marginRight: 3 }} />
                {task.assignedTo.firstName} {task.assignedTo.lastName}
              </span>
            )}
            {task.dueDate && (
              <span><Calendar size={13} style={{ display: 'inline', marginRight: 3 }} />
                Son: {formatDate(task.dueDate)}
              </span>
            )}
            {task.estimatedMinutes && (
              <span><Clock size={13} style={{ display: 'inline', marginRight: 3 }} />
                ~{Math.round(task.estimatedMinutes / 60)}s
              </span>
            )}
            <span><Flag size={13} style={{ display: 'inline', marginRight: 3 }} />
              {task.priority}
            </span>
            <span>İlerleme: %{task.completionPercent}</span>
          </div>
        </div>
      </div>

      {/* Aksiyonlar */}
      {canAct && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {canApprove && (
            <button className="btn btn-success" style={{ background: '#10b981', color: 'white' }}
              onClick={() => handleStatus('MANAGER_APPROVED')} disabled={actionLoading}>
              <CheckCircle size={14} /> Onayla
            </button>
          )}
          {canRequestRevision && (
            <button className="btn btn-warning" style={{ background: '#f59e0b', color: 'white' }}
              onClick={() => {
                const note = revisionNote.trim() || 'Revize gerekli';
                handleStatus('REVISION_REQUESTED', note);
              }} disabled={actionLoading}>
              <RotateCcw size={14} /> Revize İste
            </button>
          )}
          {canRequestRevision && (
            <input className="form-input" style={{ width: 240, fontSize: '0.8rem' }}
              placeholder="Revize notu (opsiyonel)..."
              value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)}
            />
          )}
        </div>
      )}

      {/* Dosyalar */}
      {task.files && task.files.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <div className="card-title"><FileText size={16} /> Dosyalar ({task.files.length})</div>
          </div>
          {downloadError && (
            <div style={{ margin: '0 1rem 0.5rem', padding: '0.5rem 0.75rem',
              background: 'rgba(239,68,68,0.1)', borderRadius: 6, fontSize: '0.82rem', color: '#ef4444',
              display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={14} /> {downloadError}
            </div>
          )}
          <div className="card-body" style={{ padding: '0.5rem 0' }}>
            {task.files.map((file: any) => {
              const isDownloading = downloadingFileId === file.id;
              const isLink = file.fileType === 'link';
              return (
                <div key={file.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)',
                  cursor: isLink ? 'default' : 'pointer',
                }}
                  onClick={() => !isLink && handleDownloadFile(file)}
                  title={isLink ? '' : 'İndir'}
                >
                  {isLink ? <Paperclip size={14} /> : <FileText size={14} style={{ color: 'var(--accent)' }} />}
                  <span style={{ flex: 1, fontSize: '0.85rem' }}>{file.fileName}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {file.uploadedBy?.firstName} {file.uploadedBy?.lastName}
                  </span>
                  {isLink ? (
                    <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink size={14} />
                    </a>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }} disabled={isDownloading}>
                      {isDownloading ? <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                        : <Download size={14} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Yorumlar */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <div className="card-title"><MessageSquare size={16} /> Yorumlar</div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {(!task.comments || task.comments.length === 0) ? (
            <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
              Henüz yorum yapılmamış.
            </div>
          ) : (
            task.comments.map((c: any) => (
              <div key={c.id} style={{
                padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
                borderLeft: c.commentType === 'BLOCKER' ? '3px solid #ef4444' :
                            c.commentType === 'REVISION' ? '3px solid #f59e0b' :
                            c.commentType === 'APPROVAL' ? '3px solid #10b981' : '3px solid transparent',
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                  {c.user?.firstName} {c.user?.lastName}
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                    {formatDateTime(c.createdAt)}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem' }}>{c.message}</div>
              </div>
            ))
          )}
          <form onSubmit={handleComment} style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
            <input className="form-input" placeholder="Yorum ekle..." value={comment}
              onChange={(e) => setComment(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!comment.trim() || actionLoading}>
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
