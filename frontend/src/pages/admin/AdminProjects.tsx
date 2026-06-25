import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus, X, BarChart3 as ChartIcon } from 'lucide-react';
import { api } from '../../services/api';
import { formatDate } from '../../utils/format';

export function AdminProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#7c3aed');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try { const { data } = await api.get('/projects'); setProjects(Array.isArray(data) ? data : []); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/projects', { name: name.trim(), description: description.trim() || undefined, color });
      setShowCreate(false); setName(''); setDescription(''); load();
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Projeler</h1>
          <p className="page-subtitle">Tüm projeleri görüntüleyin ve yönetin</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Proje Ekle</button>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Yeni Proje</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Proje Adı</label>
                  <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Proje adı" />
                </div>
                <div className="form-group">
                  <label className="form-label">Açıklama</label>
                  <textarea className="form-textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
                <div className="form-group">
                  <label className="form-label">Renk</label>
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 60, height: 40, cursor: 'pointer' }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>Oluştur</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FolderKanban size={48} /></div>
          <div className="empty-state-text">Henüz proje bulunmuyor.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
          {projects.map((p: any) => (
            <div key={p.id} className="card" style={{ cursor: 'pointer', borderTop: `3px solid ${p.color || '#7c3aed'}` }}
              onClick={() => navigate(`/admin/tasks?project=${p.id}`)}>
              <div className="card-body" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>{p.name}</div>
                {p.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{p.description}</div>}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>📋 {p._count?.tasks ?? 0} görev</span>
                  <span>👤 {p.createdBy?.firstName} {p.createdBy?.lastName}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
