import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserCheck, AlertCircle } from 'lucide-react';
import { usersService, type EmployeeUser } from '../../services/users.service';

export function AdminEmployees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [error, setError] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await usersService.getEmployees({ search: searchDebounced || undefined });
        setEmployees(data);
      } catch (err) {
        console.error('Çalışanlar yüklenirken hata:', err);
        setError('Çalışanlar yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [searchDebounced]);

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Çalışanlar</h1>
        <p className="page-subtitle">Sistemdeki tüm çalışan hesapları</p>
      </div>

      <div className="filters-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-secondary)' }} />
          <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="alert-banner alert-error" style={{ marginBottom: '0.75rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>E-posta</th>
              <th>Pozisyon</th>
              <th>Departman</th>
              <th>Yöneticisi</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Çalışan bulunamadı.</td></tr>
            ) : (
              employees.map((e) => (
                <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/users/${e.id}`)}>
                  <td style={{ fontWeight: 500 }}>{e.firstName} {e.lastName}</td>
                  <td>{e.email}</td>
                  <td>{e.position ?? '-'}</td>
                  <td>{e.department?.name ?? '-'}</td>
                  <td>{e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : '-'}</td>
                  <td>
                    <span className={`badge ${e.status === 'ACTIVE' ? 'badge-success' : 'badge-default'}`}>
                      {e.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={(ev) => { ev.stopPropagation(); navigate(`/admin/users/${e.id}`); }}>
                      <UserCheck size={14} />
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
