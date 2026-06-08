import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { formatDateTime } from '../../utils/format';
import { api } from '../../services/api';

interface Feedback {
  id: string;
  message: string;
  createdAt: string;
  reportId: string;
  report?: { id: string; title: string };
}

export function EmployeeFeedbacks() {
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all reports and extract feedbacks
    api.get('/reports')
      .then(({ data }) => {
        const reports = Array.isArray(data) ? data : data?.data ?? [];
        const allFeedbacks: Feedback[] = [];
        for (const report of reports) {
          if (report.feedbacks?.length) {
            for (const fb of report.feedbacks) {
              allFeedbacks.push({
                ...fb,
                reportId: report.id,
                report: { id: report.id, title: report.title },
              });
            }
          }
        }
        setFeedbacks(allFeedbacks.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Geri Bildirimler</h1>
        <p className="page-subtitle">Yöneticinizden gelen geri bildirimler</p>
      </div>

      {feedbacks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><MessageSquare size={48} /></div>
          <div className="empty-state-text">Henüz geri bildirim bulunmuyor.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {feedbacks.map((fb) => (
            <div
              className="card"
              key={fb.id}
              style={{ cursor: 'pointer', borderLeft: '3px solid var(--accent)' }}
              onClick={() => navigate(`/employee/reports/${fb.reportId}`)}
            >
              <div className="card-body" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>{fb.message}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>{formatDateTime(fb.createdAt)}</span>
                      <span>·</span>
                      <span>{fb.report?.title ?? 'Rapor'}</span>
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
