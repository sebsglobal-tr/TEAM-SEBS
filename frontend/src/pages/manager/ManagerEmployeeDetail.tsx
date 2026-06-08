import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, BarChart3, FileText, FolderOpen } from 'lucide-react';
import { usersService } from '../../services/users.service';
import { workSessionsService } from '../../services/work-sessions.service';
import { formatDuration, formatDateTime } from '../../utils/format';
import type { User, WorkSession } from '../../types';

export function ManagerEmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<User | null>(null);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [userData, sessionData] = await Promise.all([
          usersService.getById(id),
          workSessionsService.getByUser(id),
        ]);
        setEmployee(userData);
        setSessions(sessionData);
      } catch (err) {
        console.error('Çalışan detayı yüklenirken hata:', err);
        navigate('/manager/employees');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;
  if (!employee) return <div className="empty-state">Çalışan bulunamadı.</div>;

  const totalActive = sessions.reduce((s, ws) => s + ws.totalActiveSeconds, 0);
  const totalBreak = sessions.reduce((s, ws) => s + ws.totalBreakSeconds, 0);

  return (
    <div>
      <button className="btn btn-ghost" onClick={() => navigate('/manager/employees')} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Geri
      </button>

      <div className="page-header">
        <h1 className="page-title">{employee.firstName} {employee.lastName}</h1>
        <p className="page-subtitle">{employee.email} · {employee.position ?? '-'}</p>
      </div>

      {/* Özet */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-card-icon manager" style={{ color: '#10b981', background: 'rgba(16,185,129,0.15)' }}><Clock size={20} /></div>
          <div>
            <div className="stat-card-label">Toplam Aktif</div>
            <div className="stat-card-value">{formatDuration(totalActive)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon manager" style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.15)' }}><Clock size={20} /></div>
          <div>
            <div className="stat-card-label">Toplam Mola</div>
            <div className="stat-card-value">{formatDuration(totalBreak)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon manager"><FileText size={20} /></div>
          <div>
            <div className="stat-card-label">Durum</div>
            <div className="stat-card-value">{employee.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon manager"><FolderOpen size={20} /></div>
          <div>
            <div className="stat-card-label">Oturum</div>
            <div className="stat-card-value">{sessions.length}</div>
          </div>
        </div>
      </div>

      {/* Çalışma Geçmişi */}
      <div className="card">
        <div className="card-header"><div className="card-title">Çalışma Geçmişi</div></div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Başlangıç</th>
                <th>Bitiş</th>
                <th>Aktif</th>
                <th>Mola</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Henüz çalışma kaydı bulunmuyor.</td></tr>
              ) : (
                sessions.slice(0, 20).map((s) => (
                  <tr key={s.id}>
                    <td>{formatDateTime(s.startedAt)}</td>
                    <td>{s.endedAt ? formatDateTime(s.endedAt) : '-'}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>{formatDuration(s.totalActiveSeconds)}</td>
                    <td>{formatDuration(s.totalBreakSeconds)}</td>
                    <td>
                      <span className={`badge ${
                        s.status === 'ACTIVE' ? 'badge-success' :
                        s.status === 'PAUSED' ? 'badge-warning' : 'badge-default'
                      }`}>
                        {s.status === 'ACTIVE' ? 'Aktif' : s.status === 'PAUSED' ? 'Duraklatıldı' : 'Tamamlandı'}
                      </span>
                    </td>
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
