import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { workSessionsService } from '../../services/work-sessions.service';
import { formatDuration } from '../../utils/format';

interface WorkSessionReport {
  userId: string;
  userName: string;
  totalActive: number;
  totalIdle: number;
  totalBreak: number;
  totalLocked: number;
  sessionCount: number;
}

export function AdminWorkSessions() {
  const [sessions, setSessions] = useState<WorkSessionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await workSessionsService.getReports(startDate, endDate);
        setSessions(data);
      } catch (err) {
        console.error('Çalışma süreleri yüklenirken hata:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const data = await workSessionsService.getReports(startDate, endDate);
      setSessions(data);
    } catch (err) {
      console.error('Arama yapılırken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Çalışma Süreleri</h1>
        <p className="page-subtitle">Tüm çalışanların çalışma süreleri</p>
      </div>

      <div className="filters-bar">
        <div>
          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Başlangıç</label>
          <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Bitiş</label>
          <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={handleSearch} style={{ marginTop: 22 }}>Getir</button>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Clock size={48} /></div>
          <div className="empty-state-text">Bu tarih aralığında veri bulunamadı.</div>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Çalışan</th>
                <th>Toplam Aktif</th>
                <th>Boşta</th>
                <th>Mola</th>
                <th>Toplam Süre</th>
                <th>Oturum Sayısı</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const total = s.totalActive + s.totalIdle + s.totalBreak + s.totalLocked;
                return (
                  <tr key={s.userId}>
                    <td style={{ fontWeight: 500 }}>{s.userName}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>{formatDuration(s.totalActive)}</td>
                    <td style={{ color: '#f59e0b' }}>{formatDuration(s.totalIdle)}</td>
                    <td style={{ color: '#8b5cf6' }}>{formatDuration(s.totalBreak)}</td>
                    <td>{formatDuration(total)}</td>
                    <td>{s.sessionCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
