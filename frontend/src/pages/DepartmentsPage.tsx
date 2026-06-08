import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { departmentsService } from '../services/departments.service';
import type { Department } from '../types';

export function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const load = () => {
    setLoading(true);
    departmentsService.getAll().then(setDepartments).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await departmentsService.create(form);
    setForm({ name: '', description: '' });
    setShowForm(false);
    load();
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Departmanlar</h1>
          <p className="page-subtitle">Departman ve takım yönetimi</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'İptal' : 'Yeni Departman'}
        </Button>
      </div>

      {showForm && (
        <Card title="Yeni Departman">
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Departman Adı</label>
              <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Açıklama</label>
              <textarea className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <Button type="submit">Oluştur</Button>
          </form>
        </Card>
      )}

      <div className="stats-grid" style={{ marginTop: '1.5rem' }}>
        {loading ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Yükleniyor...</div>
        ) : departments.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Henüz departman eklenmemiş.</div>
        ) : (
          departments.map((dept) => (
          <Card key={dept.id} title={dept.name} subtitle={dept.description}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Yönetici: {dept.manager ? `${dept.manager.firstName} ${dept.manager.lastName}` : 'Atanmamış'}
            </p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              {dept._count?.members ?? 0} çalışan · {dept._count?.teams ?? 0} takım
            </p>
          </Card>
        )))}
      </div>
    </div>
  );
}
