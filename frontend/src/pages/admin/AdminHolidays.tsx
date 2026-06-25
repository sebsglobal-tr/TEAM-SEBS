import { useEffect, useState } from 'react';
import { Calendar, Plus, X, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { formatDateTime } from '../../utils/format';

export function AdminHolidays() {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('PUBLIC');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/holidays', { params: { year } });
      setHolidays(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [year]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date) return;
    setSubmitting(true);
    try {
      await api.post('/holidays', { name: name.trim(), date, type });
      setShowCreate(false); setName(''); setDate(''); load();
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu tatili silmek istediğinize emin misiniz?')) return;
    await api.delete(`/holidays/${id}`);
    load();
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Resmi Tatiller</h1>
          <p className="page-subtitle">Tatil takvimi ve iş günü hesaplamaları</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Tatil Ekle</button>
      </div>

      <div className="filters-bar">
        <select className="form-select" value={year} onChange={(e) => setYear(parseInt(e.target.value))} style={{ width: 120 }}>
          {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header"><h3>Tatil Ekle</h3><button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}><X size={18} /></button></div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tatil Adı</label>
                  <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Ramazan Bayramı" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Tarih</label>
                  <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Tür</label>
                  <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="PUBLIC">Resmi Tatil</option>
                    <option value="RELIGIOUS">Dini Tatil</option>
                    <option value="COMPANY">Şirket Tatili</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>Ekle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead><tr><th>Tatil</th><th>Tür</th><th>Tarih</th><th>Gün</th><th>İşlem</th></tr></thead>
            <tbody>
              {holidays.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>{year} yılı için tatil bulunamadı</td></tr>
              ) : (
                holidays.map((h: any) => {
                  const d = new Date(h.date);
                  const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
                  return (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 500 }}>{h.name}</td>
                      <td><span className="badge badge-info">{h.type === 'PUBLIC' ? 'Resmi' : h.type === 'RELIGIOUS' ? 'Dini' : 'Şirket'}</span></td>
                      <td>{d.toLocaleDateString('tr-TR')}</td>
                      <td>{dayNames[d.getDay()]}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => handleDelete(h.id)}><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
