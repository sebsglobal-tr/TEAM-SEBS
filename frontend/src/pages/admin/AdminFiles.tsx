import { useEffect, useState } from 'react';
import { FolderOpen, Download, FileText, Trash2 } from 'lucide-react';
import { filesService, type FileRecord } from '../../services/files.service';
import { formatDateTime } from '../../utils/format';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminFiles() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dosyalar</h1>
        <p className="page-subtitle">Sisteme yüklenen tüm dosyalar</p>
      </div>

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
