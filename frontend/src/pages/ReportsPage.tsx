import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { Clock, Users, Coffee } from 'lucide-react';
import { reportsService, type ReportOverview } from '../services/reports.service';
import { departmentsService } from '../services/departments.service';
import { formatDuration } from '../utils/format';
import type { Department } from '../types';

type Period = 'daily' | 'weekly' | 'monthly';

function getDateRange(period: Period): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === 'daily') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'weekly') {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: 'Yapılacak',
  IN_PROGRESS: 'Devam Ediyor',
  WAITING_REVIEW: 'İnceleme',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
};

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>('weekly');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [report, setReport] = useState<ReportOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    departmentsService.getAll().then(setDepartments);
  }, []);

  useEffect(() => {
    setLoading(true);
    const { start, end } = getDateRange(period);
    reportsService
      .getOverview(start, end, departmentId || undefined)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [period, departmentId]);

  if (loading) return <div>Yükleniyor...</div>;
  if (!report) return <div>Rapor yüklenemedi</div>;

  const dailyChartData = report.dailyBreakdown.map((d) => ({
    date: d.date.slice(5),
    aktif: Math.round(d.activeSeconds / 60),
    boşta: Math.round(d.idleSeconds / 60),
    mola: Math.round(d.breakSeconds / 60),
  }));

  const taskChartData = report.taskCompletion.byStatus.map((t) => ({
    name: TASK_STATUS_LABELS[t.status] ?? t.status,
    value: t._count.id,
  }));

  const TASK_COLORS = ['#94a3b8', '#3b82f6', '#f59e0b', '#10b981', '#ef4444'];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Raporlar</h1>
        <p className="page-subtitle">Çalışma süresi ve görev performans analizi</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={period === p ? 'primary' : 'secondary'}
            onClick={() => setPeriod(p)}
          >
            {p === 'daily' ? 'Günlük' : p === 'weekly' ? 'Haftalık' : 'Aylık'}
          </Button>
        ))}
        <select
          className="form-input"
          style={{ width: 'auto', minWidth: '180px' }}
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        >
          <option value="">Tüm Departmanlar</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div className="stats-grid">
        <StatCard title="Toplam Aktif Süre" value={formatDuration(report.totals.active)} icon={Clock} color="var(--success)" />
        <StatCard title="Boşta Süre" value={formatDuration(report.totals.idle)} icon={Clock} color="var(--warning)" />
        <StatCard title="Mola Süresi" value={formatDuration(report.totals.break)} icon={Coffee} color="#8b5cf6" />
        <StatCard title="Oturum Sayısı" value={report.totalSessions} icon={Users} />
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <Card title="Günlük Aktif Süre">
          {dailyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="dk" />
                <Tooltip />
                <Line type="monotone" dataKey="aktif" stroke="#10b981" strokeWidth={2} name="Aktif (dk)" />
                <Line type="monotone" dataKey="boşta" stroke="#f59e0b" strokeWidth={2} name="Boşta (dk)" />
                <Line type="monotone" dataKey="mola" stroke="#8b5cf6" strokeWidth={2} name="Mola (dk)" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>Veri yok</p>
          )}
        </Card>

        <Card title="Süre Dağılımı">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={report.distribution.filter((d) => d.value > 0)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {report.distribution.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatDuration(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Çalışan Bazlı Karşılaştırma">
          {report.employeeComparison.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={report.employeeComparison} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 12 }} unit="dk" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="activeMinutes" fill="#10b981" name="Aktif (dk)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="idleMinutes" fill="#f59e0b" name="Boşta (dk)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>Veri yok</p>
          )}
        </Card>

        <Card title="Görev Tamamlama">
          {taskChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={taskChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {taskChartData.map((_, i) => (
                    <Cell key={i} fill={TASK_COLORS[i % TASK_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>Görev verisi yok</p>
          )}
        </Card>
      </div>
    </div>
  );
}
