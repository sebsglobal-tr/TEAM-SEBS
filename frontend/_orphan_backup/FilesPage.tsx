import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { filesService, type FileRecord } from '../services/files.service';
import { formatDateTime } from '../utils/format';

const FILE_TYPE_LABELS: Record<string, string> = {
  TASK_ATTACHMENT: 'Görev Dosyası',
  EMPLOYEE_DOCUMENT: 'Çalışan Belgesi',
  COMPANY_DOCUMENT: 'Şirket Dokümanı',
  REPORT: 'Rapor',
  DELIVERABLE: 'Teslim Dosyası',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = () => {
    const params: Record<string, string> = {};
    if (filter) params.fileType = filter;
    filesService.getAll(params).then(setFiles).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dosyalar</h1>
        <p className="page-subtitle">Tüm dosyaları görüntüle ve yönet</p>
      </div>

      <Card>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: '180px' }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Tüm Türler</option>
            {Object.entries(FILE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Dosya Adı</th>
              <th>Tür</th>
              <th>Boyut</th>
              <th>Yükleyen</th>
              <th>Tarih</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Henüz dosya yüklenmemiş.
                </td>
              </tr>
            ) : (
              files.map((file) => (
                <tr key={file.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={14} style={{ color: 'var(--accent)' }} />
                      {file.originalName}
                    </div>
                  </td>
                  <td><Badge>{FILE_TYPE_LABELS[file.fileType] ?? file.fileType}</Badge></td>
                  <td>{formatFileSize(file.size)}</td>
                  <td>{file.uploadedBy ? `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}` : '-'}</td>
                  <td>{formatDateTime(file.createdAt)}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => filesService.download(file.id, file.originalName)}>
                      <Download size={14} />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
