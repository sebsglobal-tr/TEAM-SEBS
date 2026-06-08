import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { formatDateTime } from '../../utils/format';
import { api } from '../../services/api';

interface ReportDetail {
  id: string;
  title: string;
  description?: string;
  reportType: string;
  status: string;
  files: Array<{ id: string; fileName: string; fileType: string; fileSize: number }>;
  feedbacks: Array<{ id: string; message: string; createdAt: string; employee: { firstName: string; lastName: string } }>;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor',
  REVIEWED: 'İncelendi',
  REVISION_REQUESTED: 'Revizyon İstenen',
  APPROVED: 'Onaylandı',
};

export function EmployeeReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/reports/${id}`)
      .then(({ data }) => setReport(data))
      .catch(() => navigate('/employee/reports'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;
  if (!report) return <div className="empty-state">Rapor bulunamadı.</div>;

  return (
    <div>
      <button className="btn btn-ghost" onClick={() => navigate('/employee/reports')} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Geri
      </button>

      <div className="page-header">
        <h1 className="page-title">{report.title}</h1>
        <p className="page-subtitle">{formatDateTime(report.createdAt)}</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Rapor Detayı</div>
          <span className={`badge ${
            report.status === 'APPROVED' ? 'badge-success' :
            report.status === 'REVISION_REQUESTED' ? 'badge-danger' :
            report.status === 'REVIEWED' ? 'badge-info' : 'badge-warning'
          }`}>
            {STATUS_LABELS[report.status] ?? report.status}
          </span>
        </div>
        <div className="card-body">
          {report.description && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 8 }}>
              {report.description}
            </div>
          )}

          {/* Files */}
          {report.files.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div className="form-label">Dosyalar</div>
              {report.files.map((file) => (
                <div key={file.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: 6, marginBottom: '0.35rem',
                }}>
                  <span style={{ fontSize: '0.85rem' }}>{file.fileName}</span>
                  <button className="btn btn-ghost btn-sm">
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Feedbacks */}
          {report.feedbacks.length > 0 && (
            <div>
              <div className="form-label">Geri Bildirimler</div>
              {report.feedbacks.map((fb) => (
                <div key={fb.id} style={{
                  padding: '0.75rem', borderLeft: '3px solid var(--accent)',
                  background: 'var(--bg-primary)', borderRadius: 6, marginBottom: '0.5rem',
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {fb.employee.firstName} {fb.employee.lastName}
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>{fb.message}</div>
                </div>
              ))}
            </div>
          )}

          {report.feedbacks.length === 0 && report.files.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
              Henüz geri bildirim veya dosya bulunmuyor.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
