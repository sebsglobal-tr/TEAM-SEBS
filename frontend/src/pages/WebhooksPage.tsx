import { useEffect, useState } from 'react';
import { Webhook, Plus, X, Trash2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/webhooks');
      setWebhooks(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || events.length === 0) return;
    setSubmitting(true);
    try {
      await api.post('/webhooks', { url: url.trim(), events });
      setShowForm(false);
      setUrl('');
      setEvents([]);
      load();
    } finally { setSubmitting(false); }
  };

  const toggleEvent = (ev: string) => {
    setEvents((prev) => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu webhook\'u silmek istediğinize emin misiniz?')) return;
    await api.delete(`/webhooks/${id}`);
    load();
  };

  const ALL_EVENTS = ['task.created', 'task.updated', 'task.completed', 'leave.created', 'leave.approved', 'report.submitted'];

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Webhook Yönetimi</h1>
          <p className="page-subtitle">Harici sistemlere entegrasyon için webhook URL'leri</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Webhook Ekle</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Webhook Ekle</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">URL</label>
                  <input className="form-input" value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/webhook" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Olaylar</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {ALL_EVENTS.map((ev) => (
                      <label key={ev} style={{
                        display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                        padding: '0.3rem 0.6rem', borderRadius: 6,
                        background: events.includes(ev) ? 'var(--accent-light)' : 'var(--bg-primary)',
                        fontSize: '0.78rem',
                      }}>
                        <input type="checkbox" checked={events.includes(ev)}
                          onChange={() => toggleEvent(ev)} style={{ accentColor: 'var(--accent)' }} />
                        {ev}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead><tr><th>URL</th><th>Olaylar</th><th>Oluşturulma</th><th>İşlem</th></tr></thead>
            <tbody>
              {webhooks.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Webhook bulunamadı</td></tr>
              ) : (
                webhooks.map((w: any) => (
                  <tr key={w.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.url}</td>
                    <td><div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {(w.events || []).map((ev: string) => (
                        <span key={ev} className="badge badge-info">{ev}</span>
                      ))}
                    </div></td>
                    <td style={{ fontSize: '0.78rem' }}>{new Date(w.createdAt).toLocaleDateString('tr-TR')}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => handleDelete(w.id)}><Trash2 size={14} /></button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
