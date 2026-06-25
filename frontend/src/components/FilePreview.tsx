import { useState } from 'react';
import { X, Download, FileText, FileImage } from 'lucide-react';
import { filesService } from '../services/files.service';

interface FilePreviewProps {
  fileId: string;
  fileName: string;
  mimeType: string;
  onClose: () => void;
}

export function FilePreview({ fileId, fileName, mimeType, onClose }: FilePreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const canPreview = isImage || isPdf;

  useState(() => {
    if (canPreview) {
      filesService.download(fileId, fileName).then(() => setLoading(false)).catch(() => setLoading(false));
    }
  });

  const handleDownload = () => {
    filesService.download(fileId, fileName);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1001 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{
        maxWidth: '90vw', maxHeight: '90vh', width: 800,
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="modal-header">
          <div className="card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isImage ? <FileImage size={16} /> : <FileText size={16} />} {fileName}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={handleDownload} title="İndir">
              <Download size={16} />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose} title="Kapat">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="modal-body" style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', minHeight: 300 }}>
          {loading && <div className="loading-spinner">Yükleniyor...</div>}
          {!canPreview && (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              <FileText size={48} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p>Bu dosya türü önizlenemiyor.</p>
              <button className="btn btn-primary" onClick={handleDownload}>İndir</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
