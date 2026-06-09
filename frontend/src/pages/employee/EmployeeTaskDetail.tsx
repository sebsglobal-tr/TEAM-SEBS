import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, AlertCircle, CheckCircle, Clock, Upload,
  FileText, User, Calendar, Flag, AlertTriangle, Paperclip,
  RotateCcw, Play,
} from 'lucide-react';
import { tasksService } from '../../services/tasks.service';
import { filesService } from '../../services/files.service';
import { useAuth } from '../../hooks/useAuth';
import { formatDate, formatDateTime } from '../../utils/format';
import type { Task, TaskComment } from '../../types';

const STATUS_LABELS: Record<string, string> = {
  POOL: 'Havuzda',
  ASSIGNED_TO_MANAGER: 'Yöneticiye Atandı',
  ASSIGNED_TO_EMPLOYEE: 'Atandı',
  PENDING: 'Beklemede',
  IN_PROGRESS: 'Devam Ediyor',
  PARTIALLY_COMPLETED: 'Kısmen Tamamlandı',
  BLOCKED: 'Blokaj Var',
  SUBMITTED: 'İncelemede',
  REVISION_REQUESTED: 'Revize İstendi',
  MANAGER_APPROVED: 'Onaylandı',
  ADMIN_APPROVED: 'Admin Onaylı',
  CANCELLED: 'İptal',
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#3b82f6', LOW: '#6b7280',
};

const BLOCKER_TYPES = [
  { value: 'technical', label: 'Teknik Sorun' },
  { value: 'access', label: 'Erişim Sorunu' },
  { value: 'decision', label: 'Karar Bekliyor' },
  { value: 'missing_info', label: 'Eksik Bilgi' },
  { value: 'missing_brief', label: 'Tasarım/Brief Eksik' },
  { value: 'dependency', label: 'Başka Görev Bekleniyor' },
  { value: 'other', label: 'Diğer' },
];

const COMMENT_TYPE_LABELS: Record<string, string> = {
  NORMAL: 'Yorum',
  UPDATE: 'Güncelleme',
  BLOCKER: 'Blokaj',
  REVISION: 'Revize',
  APPROVAL: 'Onay',
};

export function EmployeeTaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Yorum
  const [newComment, setNewComment] = useState('');

  // Blokaj modal
  const [showBlockerModal, setShowBlockerModal] = useState(false);
  const [blockerType, setBlockerType] = useState('technical');
  const [blockerDesc, setBlockerDesc] = useState('');

  // Dosya yükleme
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDesc, setLinkDesc] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  // İlerleme
  const [completionPercent, setCompletionPercent] = useState(0);
  const [showProgressModal, setShowProgressModal] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    tasksService.getById(id).then(t => {
      setTask(t);
      setCompletionPercent(t.completionPercent ?? 0);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const isAssignee = task?.assignedToId === user?.id;

  const handleAction = async (action: () => Promise<unknown>) => {
    setActionLoading(true);
    try {
      await action();
      load();
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    await handleAction(() => tasksService.updateStatus(id!, status, ''));
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newComment.trim()) return;
    await handleAction(async () => {
      await tasksService.addComment(id, newComment.trim(), 'NORMAL');
      setNewComment('');
    });
  };

  const handleReportBlocker = async () => {
    if (!id || !blockerDesc.trim()) return;
    await handleAction(async () => {
      await tasksService.addComment(id, `[${BLOCKER_TYPES.find(b => b.value === blockerType)?.label}] ${blockerDesc}`, 'BLOCKER');
      await tasksService.updateStatus(id, 'BLOCKED', blockerDesc);
    });
    setShowBlockerModal(false);
    setBlockerDesc('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploadingFile(id);
    try {
      // Upload to files service
      const uploaded = await filesService.upload(file, { taskId: id, fileType: 'TASK_ATTACHMENT', description: file.name });
      // Register with task
      await tasksService.addFile(id, {
        fileName: uploaded.originalName,
        fileUrl: `/api/files/${uploaded.id}/download`,
        fileType: uploaded.mimeType,
        fileSize: uploaded.size,
      });
      load();
    } finally {
      setUploadingFile(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleAddLink = async () => {
    if (!id || !linkUrl.trim()) return;
    await handleAction(async () => {
      // Register link as a file record
      await tasksService.addFile(id, {
        fileName: linkDesc.trim() || linkUrl,
        fileUrl: linkUrl,
        fileType: 'link',
        fileSize: 0,
      });
      setLinkUrl('');
      setLinkDesc('');
      setShowLinkInput(false);
    });
  };

  const handleUpdateProgress = async () => {
    if (!id) return;
    await handleAction(async () => {
      await tasksService.update(id, { completionPercent } as any);
      if (completionPercent === 100) {
        await tasksService.updateStatus(id, 'SUBMITTED', 'Tamamlandı olarak gönderildi.');
      }
    });
    setShowProgressModal(false);
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;
  if (!task) return <div className="empty-state">Görev bulunamadı.</div>;

  const comments = task.comments ?? [];
  const blockerComments = comments.filter(c => c.commentType === 'BLOCKER');
  const revisionComments = comments.filter(c => c.commentType === 'REVISION');

  return (
    <div>
      {/* Geri butonu */}
      <button className="btn btn-ghost" onClick={() => navigate('/employee/tasks')} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Görevlerime Dön
      </button>

      {/* Başlık kartı */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span className={`badge ${task.status === 'IN_PROGRESS' ? 'badge-info' : task.status === 'BLOCKED' ? 'badge-danger' : task.status === 'SUBMITTED' ? 'badge-warning' : task.status === 'REVISION_REQUESTED' ? 'badge-danger' : task.status === 'MANAGER_APPROVED' || task.status === 'ADMIN_APPROVED' ? 'badge-success' : 'badge-default'}`}>
                  {STATUS_LABELS[task.status] ?? task.status}
                </span>
                <span className="badge badge-default" style={{ background: `${PRIORITY_COLORS[task.priority]}20`, color: PRIORITY_COLORS[task.priority] }}>
                  <Flag size={12} style={{ display: 'inline', marginRight: 3 }} />
                  {task.priority === 'URGENT' ? 'Acil' : task.priority === 'HIGH' ? 'Yüksek' : task.priority === 'MEDIUM' ? 'Orta' : 'Düşük'}
                </span>
                {task.taskType && (
                  <span className="badge badge-default">{task.taskType}</span>
                )}
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.35rem' }}>{task.title}</h2>
              {task.description && (
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: 1.5 }}>{task.description}</p>
              )}
              {task.expectedOutput && (
                <div style={{
                  padding: '0.5rem 0.75rem', background: 'rgba(5,150,105,0.08)',
                  borderRadius: 8, borderLeft: '3px solid #10b981', marginBottom: '0.5rem',
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Beklenen Çıktı</div>
                  <div style={{ fontSize: '0.85rem' }}>{task.expectedOutput}</div>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                {task.createdBy && (
                  <span><User size={13} style={{ display: 'inline', marginRight: 3 }} /> {task.createdBy.firstName} {task.createdBy.lastName}</span>
                )}
                {task.dueDate && (
                  <span><Calendar size={13} style={{ display: 'inline', marginRight: 3 }} /> Son Tarih: {formatDate(task.dueDate)}</span>
                )}
                {task.estimatedMinutes && (
                  <span><Clock size={13} style={{ display: 'inline', marginRight: 3 }} /> Tahmini: ~{Math.round(task.estimatedMinutes / 60)}s</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revize uyarısı */}
      {task.status === 'REVISION_REQUESTED' && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        }}>
          <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: '0.25rem' }}>Revize İstendi</div>
            {revisionComments.map(c => (
              <div key={c.id} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>
                <strong>{c.user?.firstName}:</strong> {c.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* İlerleme barı */}
      {task.completionPercent > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
            <span>İlerleme</span>
            <span>%{task.completionPercent}</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${task.completionPercent}%`,
              background: task.completionPercent > 60 ? '#10b981' : task.completionPercent > 30 ? '#f59e0b' : '#ef4444',
              borderRadius: 3, transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* Aksiyon butonları */}
      {isAssignee && task.status !== 'MANAGER_APPROVED' && task.status !== 'ADMIN_APPROVED' && task.status !== 'CANCELLED' && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {task.status === 'PENDING' || task.status === 'ASSIGNED_TO_EMPLOYEE' || task.status === 'REVISION_REQUESTED' ? (
            <button
              className="btn btn-primary"
              onClick={() => handleStatusChange('IN_PROGRESS')}
              disabled={actionLoading}
            >
              <Play size={14} /> Göreve Başla
            </button>
          ) : (
            <>
              {task.status === 'IN_PROGRESS' || task.status === 'PARTIALLY_COMPLETED' ? (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setCompletionPercent(Math.min((task.completionPercent || 0) + 10, 100));
                    setShowProgressModal(true);
                  }}
                  disabled={actionLoading}
                >
                  <RotateCcw size={14} /> İlerleme Güncelle
                </button>
              ) : null}
            </>
          )}

          {task.status !== 'BLOCKED' && ['IN_PROGRESS', 'PENDING', 'ASSIGNED_TO_EMPLOYEE', 'PARTIALLY_COMPLETED', 'REVISION_REQUESTED'].includes(task.status) && (
            <button className="btn btn-danger btn-outline" onClick={() => setShowBlockerModal(true)} disabled={actionLoading}>
              <AlertTriangle size={14} /> Blokaj Bildir
            </button>
          )}

          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile !== null}>
            <Upload size={14} /> Dosya Yükle
          </button>

          <button className="btn btn-secondary" onClick={() => setShowLinkInput(!showLinkInput)}>
            <Paperclip size={14} /> Link Ekle
          </button>

          {['IN_PROGRESS', 'PARTIALLY_COMPLETED'].includes(task.status) && (
            <button
              className="btn btn-success"
              onClick={() => handleStatusChange('SUBMITTED')}
              disabled={actionLoading}
              style={{ background: '#10b981', color: 'white' }}
            >
              <Send size={14} /> Tamamlandı Olarak Gönder
            </button>
          )}

          {task.status === 'REVISION_REQUESTED' && (
            <button
              className="btn btn-success"
              onClick={() => handleStatusChange('SUBMITTED')}
              disabled={actionLoading}
              style={{ background: '#10b981', color: 'white' }}
            >
              <Send size={14} /> Düzeltildi, Tekrar Gönder
            </button>
          )}
        </div>
      )}

      {/* Link ekleme inputu */}
      {showLinkInput && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body" style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
            <input
              className="form-input"
              placeholder="Link açıklaması (GitHub, Figma, canlı site vb.)"
              value={linkDesc}
              onChange={(e) => setLinkDesc(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="form-input"
                placeholder="URL (https://...)"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleAddLink} disabled={!linkUrl.trim() || actionLoading}>
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dosyalar ve linkler */}
      {task.files && task.files.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <div className="card-title">Dosyalar ve Linkler</div>
          </div>
          <div className="card-body" style={{ padding: '0.5rem 0' }}>
            {task.files.map(file => (
              <div key={file.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {file.fileType === 'link' ? (
                    <Paperclip size={14} style={{ color: 'var(--accent)' }} />
                  ) : (
                    <FileText size={14} style={{ color: 'var(--accent)' }} />
                  )}
                  <div>
                    <div style={{ fontSize: '0.85rem' }}>{file.fileName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {file.uploadedBy?.firstName} {file.uploadedBy?.lastName} · {formatDateTime(file.createdAt)}
                    </div>
                  </div>
                </div>
                <div>
                  {file.fileType === 'link' ? (
                    <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                      Aç
                    </a>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => window.open(file.fileUrl, '_blank')}>
                      İndir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Yorumlar */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <div className="card-title">Yorumlar ve Güncellemeler</div>
          <div className="card-subtitle">{comments.length} yorum</div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {comments.length === 0 ? (
            <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
              Henüz yorum yapılmamış.
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} style={{
                padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
                borderLeft: comment.commentType === 'BLOCKER' ? '3px solid #ef4444' :
                            comment.commentType === 'REVISION' ? '3px solid #f59e0b' :
                            comment.commentType === 'APPROVAL' ? '3px solid #10b981' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    {comment.user?.firstName} {comment.user?.lastName}
                    <span style={{
                      marginLeft: 6, fontSize: '0.65rem', fontWeight: 400, opacity: 0.6,
                    }}>
                      {COMMENT_TYPE_LABELS[comment.commentType] ?? 'Yorum'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {formatDateTime(comment.createdAt)}
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem' }}>{comment.message}</div>
              </div>
            ))
          )}

          {/* Yorum ekleme */}
          {isAssignee && (
            <form onSubmit={handleAddComment} style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="form-input"
                  placeholder="Güncelleme veya not ekleyin..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={!newComment.trim() || actionLoading}>
                  <Send size={14} />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Alt görevler */}
      {task.subTasks && task.subTasks.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <div className="card-title">Alt Görevler</div>
            <div className="card-subtitle">{task.subTasks.length} alt görev</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {task.subTasks.map(sub => (
              <div key={sub.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: sub.status === 'MANAGER_APPROVED' || sub.status === 'ADMIN_APPROVED' ? '#10b981' :
                              sub.status === 'IN_PROGRESS' ? '#3b82f6' : sub.status === 'CANCELLED' ? '#ef4444' : '#d1d5db',
                }} />
                <div style={{ fontSize: '0.85rem', flex: 1 }}>{sub.title}</div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {STATUS_LABELS[sub.status] ?? sub.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gizli dosya inputu */}
      <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload} />

      {/* Blokaj Modal */}
      {showBlockerModal && (
        <div className="modal-overlay" onClick={() => setShowBlockerModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Blokaj Bildir</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowBlockerModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Blokaj Türü</label>
                <select className="form-select" value={blockerType} onChange={(e) => setBlockerType(e.target.value)}>
                  {BLOCKER_TYPES.map(b => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Açıklama *</label>
                <textarea
                  className="form-textarea"
                  placeholder="Karşılaştığınız sorunu detaylı açıklayın..."
                  value={blockerDesc}
                  onChange={(e) => setBlockerDesc(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBlockerModal(false)}>İptal</button>
              <button className="btn btn-danger" onClick={handleReportBlocker} disabled={!blockerDesc.trim() || actionLoading}>
                <AlertTriangle size={14} /> Blokaj Bildir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* İlerleme Modal */}
      {showProgressModal && (
        <div className="modal-overlay" onClick={() => setShowProgressModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>İlerleme Güncelle</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowProgressModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Tamamlanma Yüzdesi</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={completionPercent}
                  onChange={(e) => setCompletionPercent(Number(e.target.value))}
                  style={{ width: '100%', marginTop: '0.5rem' }}
                />
                <div style={{ textAlign: 'center', fontSize: '1.25rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--accent)' }}>
                  %{completionPercent}
                </div>
                {completionPercent === 100 && (
                  <div style={{
                    marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(16,185,129,0.1)',
                    borderRadius: 6, fontSize: '0.8rem', color: '#10b981', textAlign: 'center',
                  }}>
                    %100 seçildiğinde görev "Tamamlandı olarak gönderilecek".
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowProgressModal(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleUpdateProgress} disabled={actionLoading}>
                Güncelle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
