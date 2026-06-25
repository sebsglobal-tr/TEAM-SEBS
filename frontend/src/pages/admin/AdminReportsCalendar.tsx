import { useEffect, useState } from 'react';
import {
  ChevronLeft, ChevronRight, FileText, CheckCircle, AlertCircle,
  Clock, MessageSquare, XCircle, BarChart3, User,
} from 'lucide-react';
import { formatDate, formatDateTime } from '../../utils/format';
import { api } from '../../services/api';

interface ReportEntry {
  id: string;
  title: string;
  description?: string;
  reportType: string;
  status: string;
  user: { id: string; firstName: string; lastName: string };
  createdAt: string;
  feedbacks: Array<{ id: string; message: string }>;
  _count?: { files: number; feedbacks: number };
}

interface DailyReport {
  date: string;
  reports: ReportEntry[];
  employeeName: string;
  employeeId: string;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-warning',
  REVIEWED: 'badge-info',
  REVISION_REQUESTED: 'badge-danger',
  APPROVED: 'badge-success',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Bekliyor',
  REVIEWED: 'İncelendi',
  REVISION_REQUESTED: 'Revizyon',
  APPROVED: 'Onaylandı',
};

const TYPE_LABEL: Record<string, string> = {
  DAILY: 'Günlük', WEEKLY: 'Haftalık', TASK: 'Görev',
  TRAINING: 'Eğitim', OTHER: 'Diğer',
};

export function AdminReportsCalendar() {
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Fetch employees
  useEffect(() => {
    api.get('/users/employees')
      .then((r) => setEmployees(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  // Fetch reports for the month
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const startDate = new Date(currentMonth);
        startDate.setDate(1);
        const endDate = new Date(currentMonth);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);

        const params: any = {
          page: '1',
          limit: '500',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        };

        const { data } = await api.get('/reports', { params });
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setReports(list);
      } catch (err) {
        console.error('Raporlar yüklenirken hata:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentMonth]);

  const filteredReports = selectedEmployee === 'all'
    ? reports
    : reports.filter(r => r.user.id === selectedEmployee);

  // Build day → reports map
  const today = new Date();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay(); // 0=Sun

  const dayReports = new Map<string, ReportEntry[]>();
  for (const report of filteredReports) {
    const dateKey = report.createdAt.split('T')[0];
    const existing = dayReports.get(dateKey) || [];
    existing.push(report);
    dayReports.set(dateKey, existing);
  }

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const monthName = currentMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  const selectedReports = selectedDate ? dayReports.get(selectedDate) || [] : [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Çalışan Rapor Takvimi</h1>
        <p className="page-subtitle">Çalışanların günlük raporlarını takvim görünümünde inceleyin</p>
      </div>

      {/* Filtreler */}
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
      </div>

      {/* Takvim */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <button className="btn btn-ghost btn-sm" onClick={prevMonth}>
            <ChevronLeft size={18} />
          </button>
          <div className="card-title" style={{ textTransform: 'capitalize' }}>{monthName}</div>
          <button className="btn btn-ghost btn-sm" onClick={nextMonth}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div style={{ padding: '1rem' }}>
          {/* Gün isimleri */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px',
            marginBottom: '4px',
          }}>
            {['Pts', 'Sal', 'Çar', 'Per', 'Cu', 'Cts', 'Paz'].map(d => (
              <div key={d} style={{
                textAlign: 'center', fontWeight: 600, fontSize: '0.75rem',
                color: 'var(--text-secondary)', padding: '0.35rem',
              }}>{d}</div>
            ))}
          </div>

          {/* Takvim günleri */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px',
          }}>
            {/* Boş hücreler (ayın ilk gününe kadar) */}
            {Array.from({ length: firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 }).map((_, i) => (
              <div key={`empty-${i}`} style={{ minHeight: 80, background: 'transparent' }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, day) => {
              const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day + 1);
              const dateStr = date.toISOString().split('T')[0];
              const dayReportsList = dayReports.get(dateStr) || [];
              const isToday = date.toDateString() === today.toDateString();
              const isSelected = selectedDate === dateStr;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  style={{
                    minHeight: 90, borderRadius: 8, padding: '4px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent-light)' :
                                dayReportsList.length > 0 ? 'rgba(16,185,129,0.06)' :
                                'var(--bg-primary)',
                    border: isToday ? '2px solid var(--accent)' :
                           isSelected ? '2px solid var(--accent)' :
                           dayReportsList.length > 0 ? '1px solid rgba(16,185,129,0.2)' :
                           '1px solid transparent',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = dayReportsList.length > 0 ? 'rgba(16,185,129,0.2)' : 'transparent'; }}
                >
                  <div style={{
                    fontSize: '0.72rem', fontWeight: 600, marginBottom: 2,
                    color: isToday ? 'var(--accent)' : 'var(--text-secondary)',
                  }}>{day + 1}</div>
                  {dayReportsList.slice(0, 2).map((r, i) => (
                    <div key={i} style={{
                      fontSize: '0.6rem', padding: '1px 3px', borderRadius: 3,
                      marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', background: 'rgba(16,185,129,0.1)',
                      color: '#10b981', fontWeight: 500,
                    }} title={r.title}>
                      {r.title.substring(0, 18)}
                    </div>
                  ))}
                  {dayReportsList.length > 2 && (
                    <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', paddingLeft: 2 }}>
                      +{dayReportsList.length - 2} daha
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Seçili günün raporları */}
      {selectedDate && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <FileText size={16} /> {formatDate(selectedDate)} — Raporlar ({selectedReports.length})
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDate(null)}>
              Kapat
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {selectedReports.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Bu tarihte rapor bulunmuyor.
              </div>
            ) : (
              selectedReports.map((report) => (
                <div key={report.id} style={{
                  padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.9rem' }}>{report.title}</strong>
                        <span className={`badge ${STATUS_BADGE[report.status] ?? 'badge-default'}`}>
                          {STATUS_LABEL[report.status] ?? report.status}
                        </span>
                        <span className="badge badge-default" style={{ fontSize: '0.65rem' }}>
                          {TYPE_LABEL[report.reportType] ?? report.reportType}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <User size={12} /> {report.user.firstName} {report.user.lastName}
                        </span>
                        <span style={{ marginLeft: '0.75rem' }}>
                          <Clock size={12} style={{ display: 'inline', marginRight: 2 }} />
                          {formatDateTime(report.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {report.description && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.35rem 0', lineHeight: 1.5 }}>
                      {report.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {report._count && <span>📎 {report._count.files} dosya</span>}
                    {report.feedbacks.length > 0 && (
                      <span>💬 {report.feedbacks.length} geri bildirim</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
