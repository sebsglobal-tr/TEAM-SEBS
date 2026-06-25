import { useEffect, useState } from 'react';
import { BarChart3, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { formatDuration } from '../../utils/format';

export function AdminEstimates() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/tasks', { params: { limit: '500' } });
        const list = Array.isArray(data) ? data : [];
        // Filter tasks that have estimated or actual time
        const withTime = list.filter((t: any) => (t.estimatedMinutes || t.actualMinutes > 0) && t.status !== 'POOL');
        setTasks(withTime);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  // Compute stats
  const totalEstimated = tasks.reduce((s: number, t: any) => s + (t.estimatedMinutes || 0), 0);
  const totalActual = tasks.reduce((s: number, t: any) => s + t.actualMinutes, 0);
  const accuracy = totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0;
  const onTime = tasks.filter((t: any) => t.actualMinutes <= (t.estimatedMinutes || Infinity)).length;
  const overTime = tasks.filter((t: any) => t.actualMinutes > (t.estimatedMinutes || 0) && t.estimatedMinutes).length;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tahmin vs Gerçekleşen</h1>
        <p className="page-subtitle">Görev süre tahminleri ve gerçekleşen süre karşılaştırması</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card" style={{ borderLeft: '3px solid #7c3aed' }}>
          <div className="stat-card-icon admin"><BarChart3 size={20} /></div>
          <div><div className="stat-card-label">Toplam Tahmini</div><div className="stat-card-value">{formatDuration(totalEstimated * 60)}</div></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #10b981' }}>
          <div className="stat-card-icon admin" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}><Clock size={20} /></div>
          <div><div className="stat-card-label">Toplam Gerçekleşen</div><div className="stat-card-value">{formatDuration(totalActual * 60)}</div></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="stat-card-icon admin" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}><AlertTriangle size={20} /></div>
          <div><div className="stat-card-label">Doğruluk Oranı</div><div className="stat-card-value">%{accuracy}</div></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #3b82f6' }}>
          <div className="stat-card-icon admin" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}><CheckCircle size={20} /></div>
          <div><div className="stat-card-label">Zamanında</div><div className="stat-card-value">{onTime}/{tasks.length}</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title"><BarChart3 size={16} /> Görev Bazında Karşılaştırma</div></div>
        <div className="table-responsive">
          <table className="table">
            <thead><tr><th>Görev</th><th>Tahmini</th><th>Gerçekleşen</th><th>Fark</th><th>Durum</th></tr></thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Henüz veri bulunmuyor</td></tr>
              ) : (
                tasks.map((t: any) => {
                  const est = t.estimatedMinutes || 0;
                  const act = t.actualMinutes;
                  const diff = act - est;
                  const diffLabel = est > 0 ? `${diff > 0 ? '+' : ''}${Math.round(diff)}dk` : '—';
                  const diffColor = diff > 0 ? '#ef4444' : diff < 0 ? '#10b981' : 'var(--text-secondary)';
                  return (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 500, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                      <td>{est > 0 ? `${Math.round(est / 60)}s ${est % 60}dk` : '—'}</td>
                      <td style={{ fontWeight: 600 }}>{act > 0 ? `${Math.round(act / 60)}s ${act % 60}dk` : '0dk'}</td>
                      <td style={{ color: diffColor, fontWeight: 600 }}>{diffLabel}</td>
                      <td>
                        {est > 0 && act > 0 ? (
                          <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, (act / est) * 100)}%`, height: '100%', background: act <= est ? '#10b981' : '#ef4444', borderRadius: 3 }} />
                          </div>
                        ) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>—</span>}
                      </td>
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
