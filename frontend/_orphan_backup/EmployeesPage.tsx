import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { usersService } from '../services/users.service';
import { departmentsService } from '../services/departments.service';
import { ROLE_LABELS, STATUS_LABELS } from '../utils/format';
import type { User, Department } from '../types';

export function EmployeesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', role: 'EMPLOYEE', departmentId: '', position: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      search ? usersService.getAll({ search }) : usersService.getAll(),
      departmentsService.getAll(),
    ])
      .then(([u, d]) => {
        setUsers(Array.isArray(u) ? u : u.data ?? []);
        setDepartments(d);
      })
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await usersService.create({
      ...form,
      departmentId: form.departmentId || undefined,
    });
    setShowForm(false);
    setForm({ firstName: '', lastName: '', email: '', password: '', role: 'EMPLOYEE', departmentId: '', position: '' });
    load();
  };

  const handleDeactivate = async (id: string) => {
    if (confirm('Bu çalışanı pasife almak istediğinize emin misiniz?')) {
      await usersService.deactivate(id);
      load();
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Çalışanlar</h1>
          <p className="page-subtitle">Çalışan yönetimi ve durum takibi</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'İptal' : 'Yeni Çalışan'}
        </Button>
      </div>

      {showForm && (
        <Card title="Yeni Çalışan Ekle" className="mb-4">
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Ad</label>
                <input className="form-input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Soyad</label>
                <input className="form-input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">E-posta</label>
                <input type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Şifre</label>
                <input type="password" className="form-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              </div>
              <div className="form-group">
                <label className="form-label">Rol</label>
                <select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="EMPLOYEE">Çalışan</option>
                  <option value="MANAGER">Yönetici</option>
                  <option value="SUPER_ADMIN">Süper Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Departman</label>
                <select className="form-input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                  <option value="">Seçiniz</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Pozisyon</label>
                <input className="form-input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
            </div>
            <Button type="submit">Kaydet</Button>
          </form>
        </Card>
      )}

      <Card>
        {/* Arama */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: '2rem' }}
              placeholder="İsim veya e-posta ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {users.length} çalışan
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Yükleniyor...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>E-posta</th>
                <th>Rol</th>
                <th>Departman</th>
                <th>Durum</th>
                <th>Anlık</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {search ? 'Aramanızla eşleşen çalışan bulunamadı.' : 'Henüz çalışan eklenmemiş.'}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <Link to={`/employees/${user.id}`} style={{ color: 'var(--accent)', fontWeight: 500 }}>
                        {user.firstName} {user.lastName}
                      </Link>
                    </td>
                    <td>{user.email}</td>
                    <td>{ROLE_LABELS[user.role]}</td>
                    <td>{user.department?.name ?? '-'}</td>
                    <td>
                      <Badge variant={user.status === 'ACTIVE' ? 'success' : 'danger'}>
                        {user.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </td>
                    <td>{STATUS_LABELS[user.currentStatus ?? 'OFFLINE'] ?? '-'}</td>
                    <td>
                      {user.status === 'ACTIVE' && user.role !== 'SUPER_ADMIN' && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeactivate(user.id)}>
                          Pasife Al
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
