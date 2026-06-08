import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usersService } from '../../services/users.service';
import { formatDateTime } from '../../utils/format';
import type { User } from '../../types';

export function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    usersService.getById(id)
      .then(setUser)
      .catch(() => navigate('/admin/users'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;
  if (!user) return <div className="empty-state">Kullanıcı bulunamadı.</div>;

  return (
    <div>
      <button className="btn btn-ghost" onClick={() => navigate('/admin/users')} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Geri
      </button>

      <div className="page-header">
        <h1 className="page-title">{user.firstName} {user.lastName}</h1>
        <p className="page-subtitle">{user.email} · {user.position ?? '-'}</p>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Kullanıcı Bilgileri</div></div>
        <div className="card-body">
          <div className="grid-2">
            <div>
              <div className="form-label">Rol</div>
              <div>{user.role}</div>
            </div>
            <div>
              <div className="form-label">Durum</div>
              <span className={`badge ${user.status === 'ACTIVE' ? 'badge-success' : 'badge-default'}`}>
                {user.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
              </span>
            </div>
            <div>
              <div className="form-label">Departman</div>
              <div>{user.department?.name ?? '-'}</div>
            </div>
            <div>
              <div className="form-label">Kayıt Tarihi</div>
              <div>{formatDateTime(user.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
