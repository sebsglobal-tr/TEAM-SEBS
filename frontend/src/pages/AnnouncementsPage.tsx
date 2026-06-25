import { useEffect, useState } from 'react';
import {
  Megaphone, Plus, X, AlertCircle, Trash2,
  Send, User, Clock, Shield,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { formatDateTime } from '../utils/format';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  targetRole: string;
  author: { id: string; firstName: string; lastName: string; role: string };
  createdAt: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#10b981',
  NORMAL: '#3b82f6',
  HIGH: '#f59e0b',
  URGENT: '#ef4444',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  URGENT: 'Acil',
};

const ROLE_LABELS: Record<string, string> = {
  ALL: 'Tüm Kullanıcılar',
  MANAGER: 'Yöneticiler',
  EMPLOYEE: 'Çalışanlar',
};

export function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [targetRole, setTargetRole] = useState('ALL');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/announcements');
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Duyurular yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('Başlık ve içerik zorunludur');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/announcements', {
        title: title.trim(),
        content: content.trim(),
        priority,
        targetRole,
      });
      setShowCreate(false);
      setTitle('');
      setContent('');
      setPriority('NORMAL');
      setTargetRole('ALL');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Duyuru oluşturulurken hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/announcements/${id}`);
      load();
    } catch (err) {
      console.error('Duyuru silinirken hata:', err);
    }
  };

  const canCreate = user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER';

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Duyurular</h1>
          <p className="page-subtitle">Sistem genelinde yayınlanan duyurular</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Yeni Duyuru
          </button>
        )}
      </div>

      {error && (
        <div className="alert-banner alert-error">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Yeni Duyuru Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Yeni Duyuru</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Başlık *</label>
                  <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Duyuru başlığı" required />
                </div>
                <div className="form-group">
                  <label className="form-label">İçerik *</label>
                  <textarea className="form-textarea" value={content} onChange={(e) => setContent(e.target.value)}
                    placeholder="Duyuru içeriği..." rows={5} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Öncelik</label>
                    <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                      {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hedef Kitle</label>
                    <select className="form-select" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <Send size={14} /> {submitting ? 'Yayınlanıyor...' : 'Yayınla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duyuru Listesi */}
      {announcements.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Megaphone size={48} /></div>
          <div className="empty-state-text">Henüz duyuru bulunmuyor.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {announcements.map((a) => {
            const priorityColor = PRIORITY_COLORS[a.priority] ?? '#3b82f6';
            return (
              <div key={a.id} className="card" style={{ borderLeft: `4px solid ${priorityColor}` }}>
                <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                        <strong style={{ fontSize: '0.95rem' }}>{a.title}</strong>
                        <span className="badge" style={{ background: `${priorityColor}20`, color: priorityColor, fontWeight: 600 }}>
                          {PRIORITY_LABELS[a.priority] ?? a.priority}
                        </span>
                        <span className="badge badge-default">{ROLE_LABELS[a.targetRole] ?? a.targetRole}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0.35rem 0' }}>
                        {a.content}
                      </p>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <User size={12} /> {a.author.firstName} {a.author.lastName}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={12} /> {formatDateTime(a.createdAt)}
                        </span>
                      </div>
                    </div>
                    {(user?.role === 'SUPER_ADMIN' || a.author.id === user?.id) && (
                      <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444', flexShrink: 0 }}
                        onClick={() => handleDelete(a.id)}>
                        <Trash2 size={14} />
                      </button>
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
