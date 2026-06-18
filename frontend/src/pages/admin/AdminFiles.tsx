import { useEffect, useState, useRef } from 'react';
import { FolderOpen, Download, FileText, Trash2, Upload, FolderUp, X, CheckCircle, AlertCircle } from 'lucide-react';
import { filesService, type FileRecord } from '../../services/files.service';
import { formatDateTime } from '../../utils/format';

const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.rar,.html,.htm,.css,.js,.ts,.tsx,.jsx,.vue,.java,.py,.php,.go,.rs,.swift,.kt,.c,.cpp,.cs,.sql,.md,.xml,.json,.yml,.yaml,.svg,.txt,.csv,.env,.gitignore';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminFiles() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isFolderMode, setIsFolderMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    filesService.getAll()
      .then(setFiles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return;
    try {
      await filesService.remove(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error('Dosya silinirken hata:', err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await filesService.uploadMultiple(selectedFiles);
      setUploadResult({ success: true, message: `${result.count} dosya başarıyla yüklendi!` });
      setSelectedFiles([]);
      // Refresh file list
      const updated = await filesService.getAll();
      setFiles(updated);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setUploadResult({ success: false, message: typeof msg === 'string' ? msg : 'Yükleme sırasında hata oluştu' });
    } finally {
      setUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setUploadResult(null);
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dosyalar</h1>
        <p className="page-subtitle">Sisteme yüklenen tüm dosyalar</p>
      </div>

      {/* Upload Area */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Upload size={16} /> Dosya / Klasör Yükle
          </div>
        </div>
        <div className="card-body">
          {uploadResult && (
            <div style={{
              padding: '0.65rem 1rem', borderRadius: 8, marginBottom: '0.75rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem',
              background: uploadResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: uploadResult.success ? '#10b981' : '#ef4444',
            }}>
              {uploadResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {uploadResult.message}
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setUploadResult(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <button className={`btn btn-sm ${!isFolderMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setIsFolderMode(false); fileInputRef.current?.click(); }}>
              <FileText size={14} /> Dosya Seç
            </button>
            <button className={`btn btn-sm ${isFolderMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setIsFolderMode(true); folderInputRef.current?.click(); }}>
              <FolderUp size={14} /> Klasör Seç
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileSelect}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            hidden
            // @ts-ignore - webkitdirectory is a non-standard attribute for folder upload
            webkitdirectory=""
            onChange={handleFileSelect}
          />

          {selectedFiles.length > 0 && (
            <div style={{
              border: '1px solid var(--border)', borderRadius: 8,
              maxHeight: 200, overflowY: 'auto', marginBottom: '0.75rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 600 }}>
                <span>{selectedFiles.length} dosya seçildi</span>
                <span>Toplam: {formatFileSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))}</span>
              </div>
              {selectedFiles.slice(0, 20).map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }}>
                  <FileText size={12} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.webkitRelativePath || f.name}</span>
                  <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{formatFileSize(f.size)}</span>
                </div>
              ))}
              {selectedFiles.length > 20 && (
                <div style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  ... ve {selectedFiles.length - 20} dosya daha
                </div>
              )}
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Yükleniyor...' : `${selectedFiles.length} Dosyayı Yükle`}
              </button>
              <button className="btn btn-secondary" onClick={clearSelection} disabled={uploading}>
                İptal
              </button>
            </div>
          )}

          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Desteklenen: PDF, DOC, XLS, resim, ZIP, HTML, CSS, JS, TS, Java, Python, PHP, JSON, XML, SVG, SQL, MD ve diğer kod dosyaları
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FolderOpen size={48} /></div>
          <div className="empty-state-text">Henüz dosya bulunmuyor.</div>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Dosya Adı</th>
                <th>Yükleyen</th>
                <th>Tür</th>
                <th>Boyut</th>
                <th>Tarih</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id}>
                  <td style={{ fontWeight: 500 }}>
                    <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    {file.originalName}
                  </td>
                  <td>{file.uploadedBy ? `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}` : '-'}</td>
                  <td><span className="badge badge-default">{file.fileType}</span></td>
                  <td>{formatFileSize(file.size)}</td>
                  <td>{formatDateTime(file.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => filesService.download(file.id, file.originalName)}>
                        <Download size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(file.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
