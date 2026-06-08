import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const REPORT_TYPES = [
  { value: 'DAILY', label: 'Günlük Rapor' },
  { value: 'WEEKLY', label: 'Haftalık Rapor' },
  { value: 'TASK', label: 'Görev Raporu' },
  { value: 'TRAINING', label: 'Eğitim Raporu' },
  { value: 'OTHER', label: 'Diğer' },
];

const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip';

export function EmployeeUploadReport() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reportType, setReportType] = useState('DAILY');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Lütfen bir başlık girin');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // First create the report
      const { data: report } = await api.post('/reports', {
        title: title.trim(),
        description: description.trim() || undefined,
        reportType,
      });

      // Upload file if selected
      if (file && report.id) {
        const formData = new FormData();
        formData.append('file', file);
        await api.post(`/reports/${report.id}/files`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/employee/reports');
      }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Rapor yüklenirken hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <CheckCircle size={64} style={{ color: '#10b981', marginBottom: '1rem' }} />
        <h2>Rapor Başarıyla Yüklendi!</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Yönlendiriliyorsunuz...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Rapor Yükle</h1>
        <p className="page-subtitle">Günlük, haftalık veya görev raporu yükleyin</p>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <div className="card-body">
            {error && (
              <div style={{
                padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)',
                color: '#ef4444', borderRadius: 8, marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem',
              }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Rapor Türü</label>
              <select className="form-select" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                {REPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Başlık *</label>
              <input
                className="form-input"
                placeholder="Rapor başlığı"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Açıklama</label>
              <textarea
                className="form-textarea"
                placeholder="Rapor içeriği hakkında kısa not..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Dosya (opsiyonel)</label>
              <div
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 8, padding: '1.5rem',
                  textAlign: 'center', cursor: 'pointer',
                  background: file ? 'var(--accent-light)' : 'var(--bg-primary)',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <div>
                    <FileText size={24} style={{ color: 'var(--accent)', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 600 }}>{file.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload size={24} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
                    <div style={{ color: 'var(--text-secondary)' }}>
                      PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, ZIP (max 25MB)
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept={ALLOWED_EXTENSIONS}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </div>

          <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/employee/reports')}>
              İptal
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !title.trim()}>
              {submitting ? 'Yükleniyor...' : 'Raporu Yükle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
