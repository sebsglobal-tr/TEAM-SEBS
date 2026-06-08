import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { formatDateTime } from '../../utils/format';
import { usersService } from '../../services/users.service';
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

const STATUS_ACTIONS = [
  { value: 'REVIEWED', label: 'İncelendi', icon: CheckCircle },
  { value: 'REVISION_REQUESTED', label: 'Revizyon İste', icon: XCircle },
  { value: 'APPROVED', label: 'Onayla', icon: CheckCircle },
];

export function ManagerReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  useEffect(() => { load(); }, [statusFilter]);

  const updateStatus = async (reportId: string, status: string) => {
    setUpdatingId(reportId);
    try {
      await api.patch(`/reports/${reportId}/status`, { status });
      load();
    } catch (err) {
      console.error('Durum güncellenirken hata:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const addFeedback = async (reportId: string) => {
    const message = feedbackInputs[reportId]?.trim();
    if (!message) return;
    setUpdatingId(reportId);
    try {
      await api.post(`/reports/${reportId}/feedbacks`, { message });
      setFeedbackInputs((prev) => ({ ...prev, [reportId]: '' }));
      load();
    } catch (err) {
      console.error('Geri bildirim eklenirken hata:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Raporlar</h1>
        <p className="page-subtitle">Ekibinizdeki çalışanların raporları</p>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <strong style={{ fontSize: '1rem' }}>{report.title}</strong>
                      <span className={`badge ${STATUS_BADGES[report.status] ?? 'badge-default'}`}>
                        {STATUS_LABELS[report.status] ?? report.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {report.user.firstName} {report.user.lastName} · {formatDateTime(report.createdAt)}
                    </div>
                  </div>
                </div>

                {report.description && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    {report.description}
                  </p>
                )}

                {/* Status Update Buttons */}
                {report.status !== 'APPROVED' && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {STATUS_ACTIONS.map((action) => (
                      <button
                        key={action.value}
                        className="btn btn-sm btn-secondary"
                        onClick={() => updateStatus(report.id, action.value)}
                        disabled={updatingId === report.id || report.status === action.value}
                      >
                        {report.status === action.value ? '✓ ' : ''}{action.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Feedback List */}
                {report.feedbacks.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                      Geri Bildirimler ({report.feedbacks.length})
                    </div>
                    {report.feedbacks.map((fb) => (
                      <div key={fb.id} style={{
                        padding: '0.5rem 0.75rem', background: 'var(--bg-primary)',
                        borderRadius: 6, marginBottom: '0.35rem', fontSize: '0.8rem',
                      }}>
                        <strong>{fb.employee.firstName}:</strong> {fb.message}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Feedback */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder="Geri bildirim yaz..."
                    value={feedbackInputs[report.id] ?? ''}
                    onChange={(e) => setFeedbackInputs((prev) => ({ ...prev, [report.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addFeedback(report.id)}
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => addFeedback(report.id)} disabled={!feedbackInputs[report.id]?.trim()}>
                    <MessageSquare size={14} /> Gönder
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
