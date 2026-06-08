import { api } from './api';

export interface ReportOverview {
  period: { start: string; end: string };
  dailyBreakdown: Array<{
    date: string;
    activeSeconds: number;
    idleSeconds: number;
    breakSeconds: number;
    lockedSeconds: number;
  }>;
  totals: {
    active: number;
    idle: number;
    break: number;
    locked: number;
  };
  distribution: Array<{ name: string; value: number; color: string }>;
  employeeComparison: Array<{
    name: string;
    activeMinutes: number;
    idleMinutes: number;
    breakMinutes: number;
  }>;
  taskCompletion: {
    byStatus: Array<{ status: string; _count: { id: number } }>;
    byPriority: Array<{ priority: string; status: string; _count: { id: number } }>;
  };
  totalSessions: number;
}

export const reportsService = {
  getOverview: (startDate: string, endDate: string, departmentId?: string) =>
    api
      .get<ReportOverview>('/reports/overview', { params: { startDate, endDate, departmentId } })
      .then((r) => r.data),

  getDaily: (date: string, departmentId?: string) =>
    api.get('/reports/daily', { params: { date, departmentId } }).then((r) => r.data),

  getWeekly: (weekStart: string, departmentId?: string) =>
    api.get('/reports/weekly', { params: { weekStart, departmentId } }).then((r) => r.data),

  getMonthly: (year: number, month: number, departmentId?: string) =>
    api.get('/reports/monthly', { params: { year, month, departmentId } }).then((r) => r.data),

  getUserReport: (userId: string, startDate: string, endDate: string) =>
    api
      .get(`/reports/users/${userId}`, { params: { startDate, endDate } })
      .then((r) => r.data),

  getDepartmentReport: (departmentId: string, startDate: string, endDate: string) =>
    api
      .get(`/reports/departments/${departmentId}`, { params: { startDate, endDate } })
      .then((r) => r.data),
};
