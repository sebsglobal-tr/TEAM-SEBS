import { useEffect, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Users, Clock, Coffee,
  BarChart3, User,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatDuration } from '../../utils/format';

interface DailyEntry {
  userId: string;
  employeeName: string;
  department?: string;
  date: string;
  totalActiveSeconds: number;
  totalBreakSeconds: number;
  totalIdleSeconds: number;
  sessionCount: number;
}

export function AdminWorkCalendar() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [view, setView] = useState<'calendar' | 'table'>('calendar');
  const [stats, setStats] = useState({ total: 0, avg: 0, days: 0 });

  useEffect(() => {
    api.get('/users/employees')
      .then((r) => setEmployees(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const startDate = new Date(currentMonth);
        startDate.setDate(1);
        const endDate = new Date(currentMonth);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);

        const { data } = await api.get('/work-sessions/daily-breakdown', {
          params: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            userId: selectedEmployee !== 'all' ? selectedEmployee : undefined,
          },
        });
        const list = Array.isArray(data) ? data : [];
        setEntries(list);

        const total = list.reduce((s, e) => s + e.totalActiveSeconds, 0);
        const days = new Set(list.map(e => e.date)).size;
        setStats({
          total,
          avg: days > 0 ? Math.round(total / days) : 0,
          days: new Set(list.map(e => e.userId)).size,
        });
      } catch (err) {
        console.error('Çalışma verileri yüklenirken hata:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentMonth, selectedEmployee]);

  // Calendar data
  const today = new Date();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  // Group entries by date
  const dateMap = new Map<string, DailyEntry[]>();
  for (const entry of entries) {
    const existing = dateMap.get(entry.date) || [];
    existing.push(entry);
    dateMap.set(entry.date, existing);
  }

  // Group entries by employee for table view
  const employeeMap = new Map<string, { name: string; dept?: string; entries: DailyEntry[]; total: number }>();
  for (const entry of entries) {
    const existing = employeeMap.get(entry.userId) || {
      name: entry.employeeName,
      dept: entry.department,
      entries: [],
      total: 0,
    };
    existing.entries.push(entry);
    existing.total += entry.totalActiveSeconds;
    employeeMap.set(entry.userId, existing);
  }

  const getHourColor = (seconds: number) => {
    const hours = seconds / 3600;
    if (hours >= 8) return '#10b981';    // green
    if (hours >= 6) return '#3b82f6';    // blue
    if (hours >= 4) return '#f59e0b';    // yellow
    if (hours >= 2) return '#f97316';    // orange
    if (hours > 0) return '#ef4444';     // red
    return 'transparent';
  };

  const getHourLabel = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
  };

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const monthName = currentMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  const allUserIds = [...new Set(entries.map(e => e.userId))];
  const usersWithData = allUserIds.map(uid => {
    const userEntries = entries.filter(e => e.userId === uid);
    return {
      userId: uid,
      name: userEntries[0]?.employeeName || '',
      dept: userEntries[0]?.department,
      total: userEntries.reduce((s, e) => s + e.totalActiveSeconds, 0),
      days: userEntries.length,
    };
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Çalışma Saatleri Takvimi</h1>
        <p className="page-subtitle">Çalışanların günlük çalışma sürelerini görüntüleyin</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card" style={{ borderLeft: '3px solid #7c3aed' }}>
          <div className="stat-card-icon admin"><BarChart3 size={20} /></div>
          <div>
            <div className="stat-card-label">Toplam Çalışma</div>
            <div className="stat-card-value">{formatDuration(stats.total)}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #10b981' }}>
          <div className="stat-card-icon admin" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <Clock size={20} />
          </div>
          <div>
            <div className="stat-card-label">Günlik Ortalama</div>
            <div className="stat-card-value">{formatDuration(stats.avg)}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #3b82f6' }}>
          <div className="stat-card-icon admin" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
            <Users size={20} />
          </div>
          <div>
            <div className="stat-card-label">Çalışan</div>
            <div className="stat-card-value">{stats.days}</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-select" value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          style={{ minWidth: 220 }}
        >
          <option value="all">Tüm Çalışanlar</option>
          {employees.map((e: any) => (
            <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button className={`btn btn-sm ${view === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('calendar')}>Takvim</button>
          <button className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('table')}>Tablo</button>
        </div>
      </div>

      {view === 'calendar' ? (
        /* CALENDAR VIEW */
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <button className="btn btn-ghost btn-sm" onClick={prevMonth}>
              <ChevronLeft size={18} />
            </button>
            <div className="card-title" style={{ textTransform: 'capitalize', fontSize: '1rem' }}>{monthName}</div>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth}>
              <ChevronRight size={18} />
            </button>
          </div>

          <div style={{ padding: '0.75rem' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px',
              marginBottom: '4px',
            }}>
              {['Pts', 'Sal', 'Çar', 'Per', 'Cu', 'Cts', 'Paz'].map(d => (
                <div key={d} style={{
                  textAlign: 'center', fontWeight: 600, fontSize: '0.7rem',
                  color: 'var(--text-secondary)', padding: '0.25rem',
                }}>{d}</div>
              ))}
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px',
            }}>
              {Array.from({ length: firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 }).map((_, i) => (
                <div key={`e-${i}`} style={{ minHeight: 85, background: 'transparent' }} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, day) => {
                const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day + 1)
                  .toISOString().split('T')[0];
                const dayEntries = dateMap.get(dateStr) || [];
                const dayTotal = dayEntries.reduce((s, e) => s + e.totalActiveSeconds, 0);
                const isToday = dateStr === today.toISOString().split('T')[0];

                return (
                  <div
                    key={day}
                    style={{
                      minHeight: 85, borderRadius: 6, padding: '3px',
                      background: dayTotal > 0 ? `${getHourColor(dayTotal)}10` : 'var(--bg-primary)',
                      border: isToday ? '2px solid var(--accent)' :
                             dayTotal > 0 ? '1px solid var(--border)' : '1px solid transparent',
                      display: 'flex', flexDirection: 'column',
                    }}
                    title={`${day + 1} ${monthName}: ${dayEntries.length} çalışan, ${formatDuration(dayTotal)}`}
                  >
                    <div style={{
                      fontSize: '0.65rem', fontWeight: 600,
                      color: isToday ? 'var(--accent)' : dayTotal > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                      marginBottom: 1,
                    }}>{day + 1}</div>
                    {dayTotal > 0 && (
                      <>
                        <div style={{
                          fontSize: '0.72rem', fontWeight: 700,
                          color: getHourColor(dayTotal),
                        }}>
                          {getHourLabel(dayTotal)}
                        </div>
                        <div style={{
                          fontSize: '0.55rem', color: 'var(--text-secondary)',
                          marginTop: 'auto',
                        }}>
                          {dayEntries.length} kişi
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={{
            padding: '0.5rem 1rem', borderTop: '1px solid var(--border)',
            display: 'flex', gap: '1rem', fontSize: '0.68rem', color: 'var(--text-secondary)',
            flexWrap: 'wrap',
          }}>
            <span>Renkler (günlük aktif süre):</span>
            {[
              { color: '#10b981', label: '8s+' },
              { color: '#3b82f6', label: '6-8s' },
              { color: '#f59e0b', label: '4-6s' },
              { color: '#f97316', label: '2-4s' },
              { color: '#ef4444', label: '0-2s' },
            ].map(leg => (
              <span key={leg.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: leg.color, display: 'inline-block' }} />
                {leg.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="card">
          <div className="card-header">
            <div className="card-title"><BarChart3 size={16} /> Aylık Çalışma Süreleri</div>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Çalışan</th>
                  <th>Departman</th>
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1);
                    return <th key={i} style={{
                      fontSize: '0.6rem', textAlign: 'center', minWidth: 40,
                      color: d.toDateString() === today.toDateString() ? 'var(--accent)' : undefined,
                    }}>{i + 1}</th>;
                  })}
                  <th style={{ textAlign: 'right' }}>Toplam</th>
                </tr>
              </thead>
              <tbody>
                {usersWithData.length === 0 ? (
                  <tr><td colSpan={daysInMonth + 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    Bu aya ait çalışma verisi bulunamadı.
                  </td></tr>
                ) : (
                  usersWithData.sort((a, b) => b.total - a.total).map((u) => {
                    const dayMap = new Map(entries.filter(e => e.userId === u.userId).map(e => [e.date, e]));
                    return (
                      <tr key={u.userId}>
                        <td style={{ fontWeight: 500, fontSize: '0.78rem' }}>{u.name}</td>
                        <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{u.dept || '-'}</td>
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1)
                            .toISOString().split('T')[0];
                          const entry = dayMap.get(dateStr);
                          const secs = entry?.totalActiveSeconds || 0;
                          return (
                            <td key={i} style={{
                              textAlign: 'center', fontSize: '0.65rem', fontWeight: 600,
                              color: secs > 0 ? getHourColor(secs) : 'transparent',
                              background: secs > 0 ? `${getHourColor(secs)}08` : 'transparent',
                            }}>
                              {secs > 0 ? getHourLabel(secs) : '-'}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.78rem', color: '#10b981' }}>
                          {formatDuration(u.total)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
