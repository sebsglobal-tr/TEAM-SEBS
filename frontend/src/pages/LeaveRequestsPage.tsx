import { useEffect, useState } from 'react';
import { Calendar, Plus, X, CheckCircle, XCircle, AlertCircle, User } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatDateTime } from '../utils/format';

interface LeaveRequest {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
  rejectionReason?: string;
  user: { id: string; firstName: string; lastName: string; department?: { name: string } };
  approvedBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Yıllık İzin',
  SICK: 'Hastalık',
  PERSONAL: 'Kişisel',
  UNPAID: 'Ücretsiz',
  OTHER: 'Diğer',
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-warning',
  APPROVED: 'badge-success',
  REJECTED: 'badge-danger',
  CANCELLED: 'badge-default',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  CANCELLED: 'İptal',
};

export function LeaveRequestsPage() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [leaveType, setLeaveType] = useState('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/leaves');
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('İzin talepleri yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError('Başlangıç ve bitiş tarihi zorunludur');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('Bitiş tarihi başlangıç tarihinden önce olamaz');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/leaves', { leaveType, startDate, endDate, reason: reason.trim() || undefined });
      setShowCreate(false);
      setLeaveType('ANNUAL');
      setStartDate('');
      setEndDate('');
      setReason('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'İzin talebi oluşturulurken hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/leaves/${id}/status`, { status });
      load();
    } catch (err) {
      console.error('Durum güncellenirken hata:', err);
    }
  };

  const isManager = user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER';

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  const pendingCount = leaves.filter(l => l.status === 'PENDING').length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">İzin Talepleri</h1>
          <p className="page-subtitle">
            {pendingCount > 0 ? `${pendingCount} bekleyen talep` : 'Tüm izin talepleri'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Yeni Talep
        </button>
      </div>

      {error && (
        <div className="alert-banner alert-error"><AlertCircle size={16} /> {error}</div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>İzin Talebi Oluştur</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">İzin Türü</label>
                  <select className="form-select" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                    {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Başlangıç Tarihi</label>
                    <input type="date" className="form-input" value={startDate}
                      onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bitiş Tarihi</label>
                    <input type="date" className="form-input" value={endDate}
                      onChange={(e) => setEndDate(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Açıklama</label>
                  <textarea className="form-textarea" value={reason}
                    onChange={(e) => setReason(e.target.value)} rows={3}
                    placeholder="İzin sebebi..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Gönderiliyor...' : 'Talep Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {leaves.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Calendar size={48} /></div>
          <div className="empty-state-text">Henüz izin talebi bulunmuyor.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {leaves.map((l) => {
            const days = Math.ceil((new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
            return (
              <div key={l.id} className="card" style={{
                borderLeft: `4px solid ${l.status === 'APPROVED' ? '#10b981' : l.status === 'REJECTED' ? '#ef4444' : l.status === 'PENDING' ? '#f59e0b' : '#64748b'}`,
              }}>
                <div className="card-body" style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
                        <strong style={{ fontSize: '0.9rem' }}>{LEAVE_TYPE_LABELS[l.leaveType] ?? l.leaveType}</strong>
                        <span className={`badge ${STATUS_BADGE[l.status] ?? 'badge-default'}`}>
                          {STATUS_LABELS[l.status] ?? l.status}
                        </span>
                        <span className="badge badge-default">{days} gün</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {isManager && (
                          <span style={{ marginRight: '0.75rem' }}>
                            <User size={12} style={{ display: 'inline', marginRight: 2 }} />
                            {l.user.firstName} {l.user.lastName}
                            {l.user.department?.name && ` (${l.user.department.name})`}
                          </span>
                        )}
                        <span>📅 {formatDate(l.startDate)} → {formatDate(l.endDate)}</span>
                      </div>
                      {l.reason && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          {l.reason}
                        </div>
                      )}
                      {l.rejectionReason && (
                        <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.25rem' }}>
                          ❌ {l.rejectionReason}
                        </div>
                      )}
                      {l.approvedBy && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          Onaylayan: {l.approvedBy.firstName} {l.approvedBy.lastName}
                        </div>
                      )}
                    </div>
                    {isManager && l.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                        <button className="btn btn-success btn-sm" style={{ background: '#10b981', color: 'white' }}
                          onClick={() => handleStatus(l.id, 'APPROVED')}>
                          <CheckCircle size={14} /> Onayla
                        </button>
                        <button className="btn btn-danger btn-sm"
                          onClick={() => handleStatus(l.id, 'REJECTED')}>
                          <XCircle size={14} /> Reddet
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
