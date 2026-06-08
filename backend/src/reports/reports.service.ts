import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDailyReport(date: Date, departmentId?: string) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return this.getWorkReport(start, end, departmentId);
  }

  async getWeeklyReport(weekStart: Date, departmentId?: string) {
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return this.getWorkReport(start, end, departmentId);
  }

  async getMonthlyReport(year: number, month: number, departmentId?: string) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    return this.getWorkReport(start, end, departmentId);
  }

  async getUserReport(userId: string, startDate: Date, endDate: Date) {
    const [sessions, tasks, files] = await Promise.all([
      this.prisma.workSession.findMany({
        where: { userId, startedAt: { gte: startDate, lte: endDate } },
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.task.findMany({
        where: {
          assignedToId: userId,
          deletedAt: null,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.file.findMany({
        where: {
          uploadedById: userId,
          deletedAt: null,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    const workTotals = sessions.reduce(
      (acc, s) => ({
        active: acc.active + s.totalActiveSeconds,
        idle: acc.idle + s.totalIdleSeconds,
        break: acc.break + s.totalBreakSeconds,
        locked: acc.locked + s.totalLockedSeconds,
      }),
      { active: 0, idle: 0, break: 0, locked: 0 },
    );

    const taskStats = {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
      inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
      waitingReview: tasks.filter((t) => t.status === TaskStatus.WAITING_REVIEW).length,
    };

    return { sessions, workTotals, taskStats, filesUploaded: files.length };
  }

  async getDepartmentReport(departmentId: string, startDate: Date, endDate: Date) {
    const members = await this.prisma.user.findMany({
      where: { departmentId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });

    const reports = await Promise.all(
      members.map(async (m) => {
        const report = await this.getUserReport(m.id, startDate, endDate);
        return { user: m, ...report };
      }),
    );

    const departmentTotals = reports.reduce(
      (acc, r) => ({
        active: acc.active + r.workTotals.active,
        idle: acc.idle + r.workTotals.idle,
        break: acc.break + r.workTotals.break,
        tasksCompleted: acc.tasksCompleted + r.taskStats.completed,
      }),
      { active: 0, idle: 0, break: 0, tasksCompleted: 0 },
    );

    return { members: reports, departmentTotals };
  }

  async getOverview(startDate: Date, endDate: Date, departmentId?: string) {
    const workReport = await this.getWorkReport(startDate, endDate, departmentId);

    const where: Record<string, unknown> = {
      startedAt: { gte: startDate, lte: endDate },
    };
    if (departmentId) where.user = { departmentId };

    const sessions = await this.prisma.workSession.findMany({ where });

    const totals = sessions.reduce(
      (acc, s) => ({
        active: acc.active + s.totalActiveSeconds,
        idle: acc.idle + s.totalIdleSeconds,
        break: acc.break + s.totalBreakSeconds,
        locked: acc.locked + s.totalLockedSeconds,
      }),
      { active: 0, idle: 0, break: 0, locked: 0 },
    );

    const distribution = [
      { name: 'Aktif', value: totals.active, color: '#10b981' },
      { name: 'Boşta', value: totals.idle, color: '#f59e0b' },
      { name: 'Mola', value: totals.break, color: '#8b5cf6' },
      { name: 'Kilitli', value: totals.locked, color: '#64748b' },
    ];

    const employeeComparison = await this.getEmployeeComparison(startDate, endDate, departmentId);
    const taskReport = await this.getTaskCompletionReport(startDate, endDate, departmentId);

    return {
      ...workReport,
      totals,
      distribution,
      employeeComparison,
      taskCompletion: taskReport,
    };
  }

  private async getEmployeeComparison(startDate: Date, endDate: Date, departmentId?: string) {
    const where: Record<string, unknown> = {
      startedAt: { gte: startDate, lte: endDate },
    };
    if (departmentId) where.user = { departmentId };

    const sessions = await this.prisma.workSession.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const map = new Map<string, { name: string; active: number; idle: number; break: number }>();

    for (const s of sessions) {
      const key = s.userId;
      const existing = map.get(key) ?? {
        name: `${s.user.firstName} ${s.user.lastName}`,
        active: 0,
        idle: 0,
        break: 0,
      };
      existing.active += s.totalActiveSeconds;
      existing.idle += s.totalIdleSeconds;
      existing.break += s.totalBreakSeconds;
      map.set(key, existing);
    }

    return Array.from(map.values())
      .sort((a, b) => b.active - a.active)
      .map((e) => ({
        name: e.name,
        activeMinutes: Math.round(e.active / 60),
        idleMinutes: Math.round(e.idle / 60),
        breakMinutes: Math.round(e.break / 60),
      }));
  }

  async getTaskCompletionReport(startDate: Date, endDate: Date, departmentId?: string) {
    const where: Record<string, unknown> = {
      deletedAt: null,
      createdAt: { gte: startDate, lte: endDate },
    };
    if (departmentId) where.departmentId = departmentId;

    const tasks = await this.prisma.task.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const byPriority = await this.prisma.task.groupBy({
      by: ['priority', 'status'],
      where,
      _count: { id: true },
    });

    return { byStatus: tasks, byPriority };
  }

  private async getWorkReport(start: Date, end: Date, departmentId?: string) {
    const where: Record<string, unknown> = {
      startedAt: { gte: start, lte: end },
    };
    if (departmentId) {
      where.user = { departmentId };
    }

    const sessions = await this.prisma.workSession.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, departmentId: true },
        },
      },
    });

    const dailyBreakdown = new Map<string, {
      date: string;
      activeSeconds: number;
      idleSeconds: number;
      breakSeconds: number;
      lockedSeconds: number;
    }>();

    for (const s of sessions) {
      const dateKey = s.startedAt.toISOString().split('T')[0];
      const existing = dailyBreakdown.get(dateKey) ?? {
        date: dateKey,
        activeSeconds: 0,
        idleSeconds: 0,
        breakSeconds: 0,
        lockedSeconds: 0,
      };
      existing.activeSeconds += s.totalActiveSeconds;
      existing.idleSeconds += s.totalIdleSeconds;
      existing.breakSeconds += s.totalBreakSeconds;
      existing.lockedSeconds += s.totalLockedSeconds;
      dailyBreakdown.set(dateKey, existing);
    }

    return {
      period: { start, end },
      dailyBreakdown: Array.from(dailyBreakdown.values()),
      totalSessions: sessions.length,
    };
  }
}
