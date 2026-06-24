import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCheck, Clock, MessageSquare, FileText, AlertCircle, CheckCircle2, Upload, Download, Trash2, Users, Paperclip, ExternalLink } from 'lucide-react';
import { tasksService } from '../../services/tasks.service';
import { usersService } from '../../services/users.service';
import { filesService } from '../../services/files.service';
import { formatDate, formatDateTime } from '../../utils/format';
import type { Task } from '../../types';

const STATUS_LABELS: Record<string, string> = {
  POOL: 'Havuzda', ASSIGNED_TO_MANAGER: 'Yöneticiye Atandı',
  ASSIGNED_TO_EMPLOYEE: 'Çalışana Atandı', PENDING: 'Beklemede',
  IN_PROGRESS: 'Devam Ediyor', PARTIALLY_COMPLETED: 'Kısmen Tamamlandı',
  BLOCKED: 'Blokaj Var', SUBMITTED: 'Teslim Edildi',
  REVISION_REQUESTED: 'Revize İstendi', MANAGER_APPROVED: 'Yönetici Onayladı',
  ADMIN_APPROVED: 'Admin Onayladı', CANCELLED: 'İptal',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Düşük', MEDIUM: 'Orta', HIGH: 'Yüksek', URGENT: 'Kritik',
};

export function AdminTaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignManagerId, setAssignManagerId] = useState('');
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [t, mgrs, emps] = await Promise.all([
          tasksService.getById(id),
          usersService.getManagers(),
          usersService.getEmployees(),
        ]);
        setManagers(mgrs);
        setEmployees(emps);
        setTask(t);
      } catch (err) {
        console.error('Görev yüklenirken hata:', err);
        navigate('/admin/tasks');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleAssignToManager = async () => {
    if (!assignManagerId || !id) return;
    try {
      const updated = await tasksService.assignToManager(id, assignManagerId);
      setTask(updated);
      setAssignManagerId('');
    } catch (err) {
      console.error('Atama yapılırken hata:', err);
    }
  };

  const handleAssignToEmployee = async () => {
    if (!assignEmployeeId || !id) return;
    try {
      const updated = await tasksService.assignToEmployee(id, assignEmployeeId);
      setTask(updated);
      setAssignEmployeeId('');
    } catch (err) {
      console.error('Çalışana atama yapılırken hata:', err);
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!id) return;
    try {
      const updated = await tasksService.updateStatus(id, status);
      setTask(updated);
    } catch (err) {
      console.error('Durum güncellenirken hata:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    setUploadError('');
    try {
      // Upload to storage
      const uploaded = await filesService.upload(file, {
        taskId: id,
        fileType: 'TASK_ATTACHMENT',
        description: `${task?.title} görev dosyası`,
      });
      // Register with task so it appears in task.files (TaskFile)
      await tasksService.addFile(id, {
        fileName: uploaded.originalName,
        fileUrl: `/api/files/${uploaded.id}/download`,
        fileType: uploaded.mimeType,
        fileSize: uploaded.size,
      });
      const updated = await tasksService.getById(id);
      setTask(updated);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setUploadError(typeof msg === 'string' ? msg : 'Dosya yüklenirken hata oluştu');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return;
    try {
      await filesService.remove(fileId);
      if (id) {
        const updated = await tasksService.getById(id);
        setTask(updated);
      }
    } catch (err) {
      console.error('Dosya silinirken hata:', err);
    }
  };

  const handleDownloadFile = async (file: any) => {
    // Link tipindeki kayıtları yeni sekmede aç
    if (file.fileType === 'link') {
      window.open(file.fileUrl, '_blank', 'noopener');
      return;
    }
    setDownloadError('');
    setDownloadingFileId(file.id);
    try {
      // file.fileUrl = "/api/files/{File.id}/download" şeklinde, download fonksiyonu URL'den ID'yi çıkarır
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

  const isPool = task.status === 'POOL';
  const isAssignedToManager = task.status === 'ASSIGNED_TO_MANAGER';
  const isWithManager = !!task.responsibleManagerId || isAssignedToManager;
  const subTasks = task.subTasks ?? [];

  return (
    <div>
      <button className="btn btn-ghost" onClick={() => navigate('/admin/tasks')} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Görevlere Dön
      </button>

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h1 className="page-title" style={{ fontSize: '1.25rem' }}>{task.title}</h1>
          <span className={`badge ${task.status === 'MANAGER_APPROVED' || task.status === 'ADMIN_APPROVED' ? 'badge-success' : task.status === 'BLOCKED' ? 'badge-danger' : task.status === 'POOL' ? 'badge-default' : 'badge-info'}`}>
            {STATUS_LABELS[task.status] ?? task.status}
          </span>
          {task.isOverdue && <span className="badge badge-danger">Gecikti</span>}
        </div>
        <p className="page-subtitle">{PRIORITY_LABELS[task.priority] ?? task.priority} öncelik · {formatDateTime(task.createdAt)}</p>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Info Card */}
        <div className="card">
          <div className="card-header"><div className="card-title">Görev Bilgileri</div></div>
          <div className="card-body">
            <div className="grid-2" style={{ gap: '0.75rem' }}>
              <div><div className="form-label">Atanan</div><div>{task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : '—'}</div></div>
              <div><div className="form-label">Sorumlu Yönetici</div><div>{task.responsibleManager ? `${task.responsibleManager.firstName} ${task.responsibleManager.lastName}` : '—'}</div></div>
              <div><div className="form-label">Oluşturan</div><div>{task.createdBy?.firstName} {task.createdBy?.lastName}</div></div>
              <div><div className="form-label">Teslim Tarihi</div><div>{task.dueDate ? formatDate(task.dueDate) : '—'}</div></div>
              <div><div className="form-label">İlerleme</div><div>%{task.completionPercent}</div></div>
              <div><div className="form-label">Görev Türü</div><div>{task.taskType}</div></div>
            </div>
            {task.description && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 8, fontSize: '0.85rem' }}>
                {task.description}
              </div>
            )}
          </div>
        </div>

        {/* Actions Card */}
        <div className="card">
          <div className="card-header"><div className="card-title">İşlemler</div></div>
          <div className="card-body">
            {/* Assign to Manager */}
            {isPool && (
              <div style={{ marginBottom: '1rem' }}>
                <div className="form-label">Yöneticiye Ata</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select className="form-select" value={assignManagerId} onChange={(e) => setAssignManagerId(e.target.value)}>
                    <option value="">Yönetici seçin...</option>
                    {managers.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={handleAssignToManager} disabled={!assignManagerId}>Ata</button>
                </div>
              </div>
            )}

            {/* Assign to Employee — show when pool or already with manager */}
            {(isPool || isWithManager) && !['ASSIGNED_TO_EMPLOYEE', 'IN_PROGRESS', 'SUBMITTED', 'MANAGER_APPROVED', 'ADMIN_APPROVED', 'CANCELLED'].includes(task.status) && (
              <div style={{ marginBottom: '1rem' }}>
                <div className="form-label">Çalışana Ata</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select className="form-select" value={assignEmployeeId} onChange={(e) => setAssignEmployeeId(e.target.value)}>
                    <option value="">Çalışan seçin...</option>
                    {employees.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName} {e.department ? `(${e.department.name})` : ''}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={handleAssignToEmployee} disabled={!assignEmployeeId}>Ata</button>
                </div>
              </div>
            )}

            {/* Status actions */}
            <div className="form-label">Durum Güncelle</div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {isPool && (
                <button className="btn btn-sm btn-secondary" onClick={() => handleStatusUpdate('ASSIGNED_TO_MANAGER')}>
                  <UserCheck size={14} /> Yöneticiye Ata
                </button>
              )}
              {!FINAL_STATUSES.includes(task.status) && (
                <button className="btn btn-sm btn-secondary" onClick={() => handleStatusUpdate('ADMIN_APPROVED')}>
                  <CheckCircle2 size={14} /> Admin Onayla
                </button>
              )}
              {task.status !== 'CANCELLED' && (
                <button className="btn btn-sm btn-danger" onClick={() => handleStatusUpdate('CANCELLED')}>
                  <AlertCircle size={14} /> İptal Et
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Parent Task */}
      {task.parentTask && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header"><div className="card-title">Bağlı Olduğu Ana Görev</div></div>
          <div className="card-body">
            <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/tasks/${task.parentTask!.id}`)}>
              <strong>{task.parentTask.title}</strong>
              <span className={`badge`} style={{ marginLeft: '0.5rem' }}>{STATUS_LABELS[task.parentTask.status]}</span>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tasks */}
      {subTasks.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <div className="card-title">Alt Görevler ({subTasks.length})</div>
            <div style={{ fontSize: '0.85rem' }}>
              İlerleme: %{task.completionPercent}
            </div>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Görev</th>
                  <th>Çalışan</th>
                  <th>Durum</th>
                  <th>Teslim</th>
                </tr>
              </thead>
              <tbody>
                {subTasks.map((st: any) => (
                  <tr key={st.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/tasks/${st.id}`)}>
                    <td style={{ fontWeight: 500 }}>{st.title}</td>
                    <td>{st.assignedTo ? `${st.assignedTo.firstName} ${st.assignedTo.lastName}` : '—'}</td>
                    <td><span className={`badge ${st.status === 'MANAGER_APPROVED' ? 'badge-success' : st.status === 'SUBMITTED' ? 'badge-info' : 'badge-default'}`}>{STATUS_LABELS[st.status] ?? st.status}</span></td>
                    <td>{st.dueDate ? formatDate(st.dueDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Dosyalar ─── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FileText size={16} /> Dosyalar
            {task.files && task.files.length > 0 && (
              <span className="badge badge-info">{task.files.length}</span>
            )}
          </div>
          <label className="btn btn-primary btn-sm" style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
            <Upload size={14} /> {uploading ? 'Yükleniyor...' : 'Dosya Yükle'}
            <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>
        <div className="card-body">
          {uploadError && (
            <div className="alert-banner alert-error" style={{ marginBottom: '0.75rem' }}>
              <AlertCircle size={16} /> {uploadError}
            </div>
          )}
          {downloadError && (
            <div className="alert-banner alert-error" style={{ marginBottom: '0.75rem' }}>
              <AlertCircle size={16} /> {downloadError}
            </div>
          )}
          {!task.files || task.files.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Henüz dosya yüklenmemiş.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {task.files.map((file: any) => {
                const isLink = file.fileType === 'link';
                const isDownloading = downloadingFileId === file.id;
                return (
                  <div key={file.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 0.75rem', background: 'var(--bg-primary)',
                    borderRadius: 8, fontSize: '0.82rem',
                    cursor: isLink ? 'default' : (isDownloading ? 'wait' : 'pointer'),
                    transition: 'background 0.15s',
                  }}
                    onClick={() => !isLink && !isDownloading && handleDownloadFile(file)}
                    onMouseEnter={(e) => { if (!isLink && !isDownloading) (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-primary)'; }}
                    title={isLink ? (file.fileUrl || '') : (isDownloading ? 'İndiriliyor...' : 'İndirmek için tıklayın')}
                  >
                    {isLink ? (
                      <Paperclip size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    ) : (
                      <FileText size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    )}
                    <span style={{
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textDecoration: isLink ? 'none' : 'underline',
                      textDecorationColor: 'var(--border)', textUnderlineOffset: 3,
                    }}>
                      {file.fileName}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', flexShrink: 0 }}>
                      {file.uploadedBy?.firstName} {file.uploadedBy?.lastName}
                    </span>
                    {isLink ? (
                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px' }}
                        title="Linki aç"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px', opacity: isDownloading ? 0.5 : 1 }}
                        onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }}
                        title="Dosyayı indir"
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                        ) : (
                          <Download size={14} />
                        )}
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px', color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }} title="Dosyayı sil">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Comments */}
      {task.comments && task.comments.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">Yorumlar</div></div>
          <div className="card-body">
            {task.comments.map((c: any) => (
              <div key={c.id} style={{
                padding: '0.65rem', borderLeft: '3px solid var(--accent)',
                background: 'var(--bg-primary)', borderRadius: 6, marginBottom: '0.5rem',
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                  {c.user?.firstName} {c.user?.lastName}
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>{formatDateTime(c.createdAt)}</span>
                </div>
                <div style={{ fontSize: '0.85rem' }}>{c.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const FINAL_STATUSES = ['MANAGER_APPROVED', 'ADMIN_APPROVED', 'CANCELLED'];
