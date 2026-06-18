import { useEffect, useState } from 'react';
import { Search, UserCheck, UserX, Plus, X } from 'lucide-react';
import { usersService } from '../../services/users.service';
import { departmentsService } from '../../services/departments.service';
import { formatDateTime } from '../../utils/format';
import type { User, Department } from '../../types';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Admin',
  MANAGER: 'Yönetici',
  EMPLOYEE: 'Çalışan',
};

const CREATE_ROLES = [
  { value: 'EMPLOYEE', label: 'Çalışan' },
  { value: 'MANAGER', label: 'Yönetici' },
];

interface CreateUserForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  position: string;
  departmentId: string;
}

const emptyForm: CreateUserForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'EMPLOYEE',
  position: '',
  departmentId: '',
};

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateUserForm>(emptyForm);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const load = async () => {
    try {
      const data = await usersService.getAll({ search: search || undefined });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Kullanıcılar yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Load departments for the create form
  useEffect(() => {
    if (showCreate) {
      departmentsService.getAll()
        .then(setDepartments)
        .catch(() => {});
    }
  }, [showCreate]);

  const handleDeactivate = async (id: string) => {
    if (!confirm('Bu kullanıcıyı pasife almak istediğinize emin misiniz?')) return;
    try {
      await usersService.deactivate(id);
      load();
    } catch (err) {
      console.error('Pasife alırken hata:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);
    try {
      await usersService.create({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role || undefined,
        position: form.position.trim() || undefined,
        departmentId: form.departmentId || undefined,
      });
      setFormSuccess('Kullanıcı başarıyla oluşturuldu!');
      setForm(emptyForm);
      setTimeout(() => {
        setShowCreate(false);
        setFormSuccess('');
        load();
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setFormError(typeof msg === 'string' ? msg : 'Kullanıcı oluşturulurken hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  const updateForm = (field: keyof CreateUserForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">Tüm Kullanıcılar</h1>
          <p className="page-subtitle">Sistemdeki tüm kullanıcıları görüntüleyin ve yönetin</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Yeni Kullanıcı Ekle
        </button>
      </div>

      <div className="filters-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-secondary)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 32 }}
            placeholder="İsim, e-posta ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <button className="btn btn-primary" onClick={load}>Ara</button>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>E-posta</th>
              <th>Rol</th>
              <th>Durum</th>
              <th>Departman</th>
              <th>Kayıt</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Kullanıcı bulunamadı.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.firstName} {u.lastName}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'SUPER_ADMIN' ? 'badge-danger' : u.role === 'MANAGER' ? 'badge-info' : 'badge-success'}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-default'}`}>
                      {u.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td>{u.department?.name ?? '-'}</td>
                  <td>{formatDateTime(u.createdAt)}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDeactivate(u.id)}
                      disabled={u.status !== 'ACTIVE'}
                      title={u.status === 'ACTIVE' ? 'Pasife al' : 'Zaten pasif'}
                    >
                      {u.status === 'ACTIVE' ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Yeni Kullanıcı Oluşturma Modalı ─── */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => { if (!submitting) setShowCreate(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>Yeni Kullanıcı Oluştur</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)} disabled={submitting}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '0.65rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 8, marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div style={{ padding: '0.65rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 8, marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    {formSuccess}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ad *</label>
                    <input className="form-input" placeholder="Ad" value={form.firstName} onChange={(e) => updateForm('firstName', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Soyad *</label>
                    <input className="form-input" placeholder="Soyad" value={form.lastName} onChange={(e) => updateForm('lastName', e.target.value)} required />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">E-posta *</label>
                  <input type="email" className="form-input" placeholder="ornek@sirket.com" value={form.email} onChange={(e) => updateForm('email', e.target.value)} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Şifre *</label>
                  <input type="password" className="form-input" placeholder="En az 8 karakter" value={form.password} onChange={(e) => updateForm('password', e.target.value)} required minLength={8} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Rol</label>
                    <select className="form-select" value={form.role} onChange={(e) => updateForm('role', e.target.value)}>
                      {CREATE_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Departman</label>
                    <select className="form-select" value={form.departmentId} onChange={(e) => updateForm('departmentId', e.target.value)}>
                      <option value="">— Seçin —</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Pozisyon</label>
                  <input className="form-input" placeholder="Örn: Yazılım Geliştirici" value={form.position} onChange={(e) => updateForm('position', e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={submitting}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Oluşturuluyor...' : 'Kullanıcı Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
