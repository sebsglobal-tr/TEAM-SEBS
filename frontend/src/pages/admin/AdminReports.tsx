import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { formatDateTime } from '../../utils/format';
import { api } from '../../services/api';

interface Report {
  id: string;
  title: string;
  description?: string;
  reportType: string;
  status: string;
  user: { id: string; firstName: string; lastName: string };
  files: Array<{ id: string; fileName: string }>;
  feedbacks: Array<{ id: string; message: string; employee: { firstName: string; lastName: string } }>;
  _count: { files: number; feedbacks: number };
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

export function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const params: any = {};
        if (statusFilter) params.status = statusFilter;
        const { data } = await api.get('/reports', { params });
        setReports(Array.isArray(data) ? data : data?.data ?? []);
      } catch (err) {
        console.error('Raporlar yüklenirken hata:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [statusFilter]);

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tüm Raporlar</h1>
        <p className="page-subtitle">Sistemdeki tüm çalışan raporları</p>
      </div>

      <div className="filters-bar">
        <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tüm Durumlar</option>
          <option value="PENDING">Bekleyen</option>
          <option value="REVIEWED">İncelenen</option>
          <option value="REVISION_REQUESTED">Revizyon İstenen</option>
          <option value="APPROVED">Onaylanan</option>
        </select>
      </div>

      {reports.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><BarChart3 size={48} /></div>
          <div className="empty-state-text">Henüz rapor bulunmuyor.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reports.map((report) => (
            <div className="card" key={report.id}>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <strong>{report.title}</strong>
                      <span className={`badge ${STATUS_BADGES[report.status] ?? 'badge-default'}`}>{STATUS_LABELS[report.status] ?? report.status}</span>
                      <span className="badge badge-default">{TYPE_LABELS[report.reportType] ?? report.reportType}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {report.user.firstName} {report.user.lastName} · {formatDateTime(report.createdAt)}
                    </div>
                    {report.description && (
                      <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                        {report.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                      <span>{report._count.files} dosya</span>
                      <span>{report._count.feedbacks} geri bildirim</span>
                    </div>
                    {report.feedbacks.length > 0 && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: 6, fontSize: '0.8rem' }}>
                        <strong>Son geri bildirim:</strong> {report.feedbacks[0].employee.firstName}: {report.feedbacks[0].message}
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
