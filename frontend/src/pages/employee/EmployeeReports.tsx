import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import { formatDateTime } from '../../utils/format';
import { api } from '../../services/api';

interface Report {
  id: string;
  title: string;
  description?: string;
  reportType: string;
  status: string;
  feedbacks: Array<{ id: string; message: string; employee: { firstName: string; lastName: string } }>;
  _count?: { files: number; feedbacks: number };
  createdAt: string;
}

const STATUS_BADGES: Record<string, string> = {
  PENDING: 'badge-warning',
  REVIEWED: 'badge-info',
  REVISION_REQUESTED: 'badge-danger',
  APPROVED: 'badge-success',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor',
  REVIEWED: 'İncelendi',
  REVISION_REQUESTED: 'Revizyon İstenen',
  APPROVED: 'Onaylandı',
};

const TYPE_LABELS: Record<string, string> = {
  DAILY: 'Günlük',
  WEEKLY: 'Haftalık',
  TASK: 'Görev',
  TRAINING: 'Eğitim',
  OTHER: 'Diğer',
};

export function EmployeeReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports')
      .then(({ data }) => {
        setReports(Array.isArray(data) ? data : data?.data ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Raporlarım</h1>
          <p className="page-subtitle">Yüklediğiniz tüm raporlar</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/employee/upload-report')}>
          <Plus size={16} /> Yeni Rapor
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FileText size={48} /></div>
          <div className="empty-state-text">Henüz rapor yüklememişsiniz.</div>
          <button className="btn btn-primary" onClick={() => navigate('/employee/upload-report')} style={{ marginTop: '1rem' }}>
            İlk Raporu Yükle
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reports.map((report) => (
            <div
              className="card"
              key={report.id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/employee/reports/${report.id}`)}
            >
              <div className="card-body" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                      <strong>{report.title}</strong>
                      <span className={`badge ${STATUS_BADGES[report.status] ?? 'badge-default'}`}>
                        {STATUS_LABELS[report.status] ?? report.status}
                      </span>
                      <span className="badge badge-default">
                        {TYPE_LABELS[report.reportType] ?? report.reportType}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {formatDateTime(report.createdAt)}
                      {report._count && ` · ${report._count.files} dosya · ${report._count.feedbacks} geri bildirim`}
                    </div>
                    {report.description && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        {report.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
