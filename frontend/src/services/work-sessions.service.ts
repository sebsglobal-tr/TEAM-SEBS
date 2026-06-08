import { api } from './api';
import type { WorkSessionToday, WorkSession, EmployeeStatus } from '../types';

export interface EmployeeWorkStat {
  id: string;
  firstName: string;
  lastName: string;
  department?: { id: string; name: string };
  position?: string;
  currentStatus: EmployeeStatus;
  lastActiveAt?: string;
  todayActiveSeconds: number;
  todayIdleSeconds: number;
  todayBreakSeconds: number;
  todayLockedSeconds: number;
  pendingTasks: number;
  completedSessionsToday: number;
  hasActiveSession: boolean;
}

export interface DashboardWorkStats {
  summary: {
    totalEmployees: number;
    onlineActive: number;
    onlineIdle: number;
    onBreak: number;
    offline: number;
    totalActiveSecondsToday: number;
    workingNow: number;
  };
  employees: EmployeeWorkStat[];
}

export interface SessionTimeline {
  id: string;
  startedAt: string;
  endedAt?: string;
  totalActiveSeconds: number;
  totalIdleSeconds: number;
  totalBreakSeconds: number;
  totalLockedSeconds: number;
  status: string;
  user: { id: string; firstName: string; lastName: string };
  activityEvents: Array<{
    id: string;
    type: string;
    timestamp: string;
    durationSeconds: number;
  }>;
  breaks: Array<{
    id: string;
    startedAt: string;
    endedAt?: string;
    durationSeconds: number;
  }>;
}

export const workSessionsService = {
  getToday: () => api.get<WorkSessionToday>('/work-sessions/today').then((r) => r.data),

  start: () => api.post<WorkSession>('/work-sessions/start').then((r) => r.data),

  stop: () => api.post<WorkSession>('/work-sessions/stop').then((r) => r.data),

  startBreak: () => api.post('/work-sessions/break/start').then((r) => r.data),

  endBreak: () => api.post('/work-sessions/break/end').then((r) => r.data),

  sendHeartbeat: (status?: EmployeeStatus) =>
    api.post('/work-sessions/heartbeat', { status }).then((r) => r.data),

  getDashboardStats: () =>
    api.get<DashboardWorkStats>('/work-sessions/dashboard-stats').then((r) => r.data),

  getByUser: (userId: string, startDate?: string, endDate?: string) =>
    api
      .get<WorkSession[]>(`/work-sessions/user/${userId}`, { params: { startDate, endDate } })
      .then((r) => r.data),

  getTimeline: (sessionId: string) =>
    api.get<SessionTimeline>(`/work-sessions/${sessionId}/timeline`).then((r) => r.data),

  getReports: (startDate: string, endDate: string, params?: { userId?: string; departmentId?: string }) =>
    api
      .get('/work-sessions/reports', { params: { startDate, endDate, ...params } })
      .then((r) => r.data),
};
