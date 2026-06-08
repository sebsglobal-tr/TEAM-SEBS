import { useEffect, useState } from 'react';
import { Search, UserCheck, UserX } from 'lucide-react';
import { usersService } from '../../services/users.service';
import { formatDateTime } from '../../utils/format';
import type { User } from '../../types';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Admin',
  MANAGER: 'Yönetici',
  EMPLOYEE: 'Çalışan',
};

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const handleDeactivate = async (id: string) => {
    if (!confirm('Bu kullanıcıyı pasife almak istediğinize emin misiniz?')) return;
    try {
      await usersService.deactivate(id);
      load();
    } catch (err) {
      console.error('Pasife alırken hata:', err);
    }
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tüm Kullanıcılar</h1>
        <p className="page-subtitle">Sistemdeki tüm kullanıcıları görüntüleyin ve yönetin</p>
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
    </div>
  );
}
