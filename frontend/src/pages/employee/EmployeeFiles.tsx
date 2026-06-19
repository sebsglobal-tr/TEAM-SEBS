import { useEffect, useState } from 'react';
import { FolderOpen, Download, FileText, Upload, AlertCircle } from 'lucide-react';
import { filesService, type FileRecord } from '../../services/files.service';
import { formatDateTime } from '../../utils/format';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmployeeFiles() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    filesService.getAll()
      .then(setFiles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      await filesService.upload(file, { description: file.name });
      const updated = await filesService.getAll();
      setFiles(updated);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setUploadError(typeof msg === 'string' ? msg : 'Dosya yüklenirken hata oluştu. Dosya boyutu çok büyük olabilir.');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Dosyalarım</h1>
          <p className="page-subtitle">Yüklediğiniz dosyalar</p>
        </div>
        <label className={`btn btn-primary ${uploading ? 'btn-disabled' : ''}`} style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
          <Upload size={16} /> {uploading ? 'Yükleniyor...' : 'Dosya Yükle'}
          <input type="file" hidden onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {uploadError && (
        <div className="alert-banner alert-error" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={16} /> {uploadError}
        </div>
      )}

      {files.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FolderOpen size={48} /></div>
          <div className="empty-state-text">Henüz dosya yüklememişsiniz.</div>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Dosya Adı</th>
                <th>Açıklama</th>
                <th>Boyut</th>
                <th>Tarih</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id}>
                  <td style={{ fontWeight: 500 }}>
                    <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--accent)' }} />
                    {file.originalName}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {(file as any).description ?? '-'}
                  </td>
                  <td>{formatFileSize(file.size)}</td>
                  <td>{formatDateTime(file.createdAt)}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => filesService.download(file.id, file.originalName)}>
                      <Download size={14} />
                    </button>
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
