import { useEffect, useState } from 'react';
import { UserCog } from 'lucide-react';
import { usersService } from '../../services/users.service';

export function AdminManagers() {
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use the getAll endpoint filtered by role
    usersService.getAll({ status: 'ACTIVE' })
      .then((data) => {
        const allUsers = Array.isArray(data) ? data : [];
        setManagers(allUsers.filter((u: any) => u.role === 'MANAGER'));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Yöneticiler</h1>
        <p className="page-subtitle">Sistemdeki tüm yönetici hesapları</p>
      </div>

      {managers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><UserCog size={48} /></div>
          <div className="empty-state-text">Henüz yönetici bulunmuyor.</div>
        </div>
      ) : (
        <div className="grid-3">
          {managers.map((m) => (
            <div className="card" key={m.id}>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'rgba(37,99,235,0.15)', color: '#2563eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.9rem',
                  }}>
                    {m.firstName[0]}{m.lastName[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.firstName} {m.lastName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Departman:</span> {m.department?.name ?? '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Atanan Çalışan:</span> {(m as any)._count?.employees ?? 0}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
