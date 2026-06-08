import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WorkSessionStatus,
  EmployeeStatus,
  ActivityEventType,
  AuditAction,
  UserRole,
  UserStatus,
  TaskStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class WorkSessionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
  ) {}

  async start(userId: string) {
    const active = await this.prisma.workSession.findFirst({
      where: { userId, status: WorkSessionStatus.ACTIVE },
    });
    if (active) {
      throw new BadRequestException('Zaten aktif bir çalışma oturumunuz var');
    }

    const session = await this.prisma.workSession.create({
      data: { userId, status: WorkSessionStatus.ACTIVE },
    });

    await this.prisma.activityEvent.create({
      data: {
        userId,
        workSessionId: session.id,
        type: ActivityEventType.SESSION_START,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { currentStatus: EmployeeStatus.ONLINE_ACTIVE, lastActiveAt: new Date() },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.SESSION_START,
      entityType: 'WorkSession',
      entityId: session.id,
    });

    return session;
  }

  async stop(userId: string) {
    const session = await this.prisma.workSession.findFirst({
      where: { userId, status: WorkSessionStatus.ACTIVE },
    });
    if (!session) {
      throw new NotFoundException('Aktif çalışma oturumu bulunamadı');
    }

    const ended = await this.prisma.workSession.update({
      where: { id: session.id },
      data: { status: WorkSessionStatus.ENDED, endedAt: new Date() },
    });

    await this.prisma.activityEvent.create({
      data: {
        userId,
        workSessionId: session.id,
        type: ActivityEventType.SESSION_END,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { currentStatus: EmployeeStatus.WORK_SESSION_ENDED },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.SESSION_END,
      entityType: 'WorkSession',
      entityId: session.id,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { department: { include: { manager: true } } },
    });

    if (user?.department?.managerId) {
      await this.notificationsService.create({
        userId: user.department.managerId,
        title: 'Çalışma Oturumu Sonlandı',
        message: `${user.firstName} ${user.lastName} çalışma oturumunu bitirdi.`,
        type: NotificationType.SESSION_ENDED,
        metadata: { sessionId: session.id, userId },
      });
    }

    return ended;
  }

  async getToday(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const sessions = await this.prisma.workSession.findMany({
      where: { userId, startedAt: { gte: startOfDay } },
      orderBy: { startedAt: 'desc' },
    });

    const totals = sessions.reduce(
      (acc, s) => ({
        active: acc.active + s.totalActiveSeconds,
        idle: acc.idle + s.totalIdleSeconds,
        break: acc.break + s.totalBreakSeconds,
        locked: acc.locked + s.totalLockedSeconds,
        offline: acc.offline + s.totalOfflineSeconds,
      }),
      { active: 0, idle: 0, break: 0, locked: 0, offline: 0 },
    );

    const activeSession = sessions.find((s) => s.status === WorkSessionStatus.ACTIVE);

    return { sessions, totals, activeSession };
  }

  async getByUser(targetUserId: string, actor: JwtPayload, startDate?: Date, endDate?: Date) {
    await this.assertAccess(targetUserId, actor);

    const where: Record<string, unknown> = { userId: targetUserId };
    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) (where.startedAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.startedAt as Record<string, Date>).lte = endDate;
    }

    return this.prisma.workSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
    });
  }

  async getReports(filters: {
    userId?: string;
    departmentId?: string;
    startDate: Date;
    endDate: Date;
  }) {
    const where: Record<string, unknown> = {
      startedAt: { gte: filters.startDate, lte: filters.endDate },
    };

    if (filters.userId) {
      where.userId = filters.userId;
    } else if (filters.departmentId) {
      where.user = { departmentId: filters.departmentId };
    }

    const sessions = await this.prisma.workSession.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, departmentId: true },
        },
      },
    });

    const grouped = new Map<string, {
      userId: string;
      userName: string;
      totalActive: number;
      totalIdle: number;
      totalBreak: number;
      totalLocked: number;
      sessionCount: number;
    }>();

    for (const s of sessions) {
      const key = s.userId;
      const existing = grouped.get(key) ?? {
        userId: s.userId,
        userName: `${s.user.firstName} ${s.user.lastName}`,
        totalActive: 0,
        totalIdle: 0,
        totalBreak: 0,
        totalLocked: 0,
        sessionCount: 0,
      };
      existing.totalActive += s.totalActiveSeconds;
      existing.totalIdle += s.totalIdleSeconds;
      existing.totalBreak += s.totalBreakSeconds;
      existing.totalLocked += s.totalLockedSeconds;
      existing.sessionCount += 1;
      grouped.set(key, existing);
    }

    return Array.from(grouped.values());
  }

  async startBreak(userId: string) {
    const session = await this.getActiveSession(userId);
    const activeBreak = await this.prisma.break.findFirst({
      where: { userId, workSessionId: session.id, endedAt: null },
    });
    if (activeBreak) {
      throw new BadRequestException('Zaten moladasınız');
    }

    await this.prisma.break.create({
      data: { userId, workSessionId: session.id },
    });

    await this.prisma.activityEvent.create({
      data: {
        userId,
        workSessionId: session.id,
        type: ActivityEventType.BREAK_START,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { currentStatus: EmployeeStatus.ON_BREAK, lastActiveAt: new Date() },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.BREAK_START,
      entityType: 'WorkSession',
      entityId: session.id,
    });

    return { message: 'Mola başlatıldı', sessionId: session.id };
  }

  async endBreak(userId: string) {
    const session = await this.getActiveSession(userId);
    const activeBreak = await this.prisma.break.findFirst({
      where: { userId, workSessionId: session.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!activeBreak) {
      throw new BadRequestException('Aktif mola bulunamadı');
    }

    const now = new Date();
    const duration = Math.floor((now.getTime() - activeBreak.startedAt.getTime()) / 1000);

    await this.prisma.break.update({
      where: { id: activeBreak.id },
      data: { endedAt: now, durationSeconds: duration },
    });

    await this.prisma.workSession.update({
      where: { id: session.id },
      data: { totalBreakSeconds: { increment: duration } },
    });

    await this.prisma.activityEvent.create({
      data: {
        userId,
        workSessionId: session.id,
        type: ActivityEventType.BREAK_END,
        durationSeconds: duration,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { currentStatus: EmployeeStatus.ONLINE_ACTIVE, lastActiveAt: now },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.BREAK_END,
      entityType: 'WorkSession',
      entityId: session.id,
    });

    return { message: 'Mola bitirildi', durationSeconds: duration };
  }

  async sendHeartbeat(userId: string, status: EmployeeStatus = EmployeeStatus.ONLINE_ACTIVE) {
    const session = await this.prisma.workSession.findFirst({
      where: { userId, status: WorkSessionStatus.ACTIVE },
    });
    if (!session) {
      throw new BadRequestException('Aktif çalışma oturumu yok');
    }

    const interval = parseInt(
      this.configService.get('HEARTBEAT_INTERVAL_SECONDS', '30'),
      10,
    );

    const onBreak = await this.prisma.break.findFirst({
      where: { userId, workSessionId: session.id, endedAt: null },
    });
    const effectiveStatus = onBreak ? EmployeeStatus.ON_BREAK : status;

    await this.prisma.heartbeat.create({
      data: {
        userId,
        workSessionId: session.id,
        status: effectiveStatus,
        clientVersion: 'web-1.0',
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { currentStatus: effectiveStatus, lastActiveAt: new Date() },
    });

    const fieldMap: Partial<Record<EmployeeStatus, string>> = {
      [EmployeeStatus.ONLINE_ACTIVE]: 'totalActiveSeconds',
      [EmployeeStatus.ONLINE_IDLE]: 'totalIdleSeconds',
      [EmployeeStatus.ON_BREAK]: 'totalBreakSeconds',
      [EmployeeStatus.SCREEN_LOCKED]: 'totalLockedSeconds',
      [EmployeeStatus.OFFLINE]: 'totalOfflineSeconds',
    };

    const field = fieldMap[effectiveStatus];
    if (field) {
      await this.prisma.workSession.update({
        where: { id: session.id },
        data: { [field]: { increment: interval } },
      });
    }

    return {
      sessionId: session.id,
      status: effectiveStatus,
      intervalSeconds: interval,
    };
  }

  async getDashboardStats(actor: JwtPayload) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const userFilter = await this.buildUserFilter(actor);
    const employees = await this.prisma.user.findMany({
      where: {
        ...userFilter,
        role: UserRole.EMPLOYEE,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        department: { select: { id: true, name: true } },
        workSessions: {
          where: { startedAt: { gte: startOfDay } },
        },
        assignedTasks: {
          where: { deletedAt: null, status: { notIn: [TaskStatus.MANAGER_APPROVED, TaskStatus.ADMIN_APPROVED, TaskStatus.CANCELLED] } },
        },
      },
    }) as any;

    const employeeStats = (employees as any[]).map((emp: any) => {
      const totals = emp.workSessions.reduce(
        (acc: any, s: any) => ({
          active: acc.active + s.totalActiveSeconds,
          idle: acc.idle + s.totalIdleSeconds,
          break: acc.break + s.totalBreakSeconds,
          locked: acc.locked + s.totalLockedSeconds,
        }),
        { active: 0, idle: 0, break: 0, locked: 0 },
      );

      const completedToday = emp.workSessions.filter((s: any) => s.status === 'ENDED').length;

      return {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        department: emp.department,
        position: emp.position,
        currentStatus: emp.currentStatus,
        lastActiveAt: emp.lastActiveAt,
        todayActiveSeconds: totals.active,
        todayIdleSeconds: totals.idle,
        todayBreakSeconds: totals.break,
        todayLockedSeconds: totals.locked,
        pendingTasks: emp.assignedTasks.length,
        completedSessionsToday: completedToday,
        hasActiveSession: emp.workSessions.some((s: any) => s.status === 'ACTIVE'),
      };
    });

    const summary = {
      totalEmployees: employeeStats.length,
      onlineActive: employeeStats.filter((e) => e.currentStatus === 'ONLINE_ACTIVE').length,
      onlineIdle: employeeStats.filter((e) => e.currentStatus === 'ONLINE_IDLE').length,
      onBreak: employeeStats.filter((e) => e.currentStatus === 'ON_BREAK').length,
      offline: employeeStats.filter((e) =>
        ['OFFLINE', 'WORK_SESSION_ENDED', 'SCREEN_LOCKED'].includes(e.currentStatus),
      ).length,
      totalActiveSecondsToday: employeeStats.reduce((s, e) => s + e.todayActiveSeconds, 0),
      workingNow: employeeStats.filter((e) => e.hasActiveSession).length,
    };

    return { summary, employees: employeeStats };
  }

  async getTeamToday(actor: JwtPayload) {
    return this.getDashboardStats(actor);
  }

  async getSessionTimeline(sessionId: string, actor: JwtPayload) {
    const session = await this.prisma.workSession.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        activityEvents: { orderBy: { timestamp: 'asc' } },
        breaks: { orderBy: { startedAt: 'asc' } },
        heartbeats: { orderBy: { timestamp: 'asc' }, take: 50 },
      },
    });

    if (!session) throw new NotFoundException('Oturum bulunamadı');
    await this.assertAccess(session.userId, actor);

    return session;
  }

  async getActiveBreak(userId: string) {
    const session = await this.prisma.workSession.findFirst({
      where: { userId, status: WorkSessionStatus.ACTIVE },
    });
    if (!session) return null;

    return this.prisma.break.findFirst({
      where: { userId, workSessionId: session.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
  }

  private async getActiveSession(userId: string) {
    const session = await this.prisma.workSession.findFirst({
      where: { userId, status: WorkSessionStatus.ACTIVE },
    });
    if (!session) {
      throw new BadRequestException('Aktif çalışma oturumu bulunamadı');
    }
    return session;
  }

  private async buildUserFilter(actor: JwtPayload): Promise<Prisma.UserWhereInput> {
    if (actor.role === UserRole.SUPER_ADMIN) return {};

    if (actor.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: { id: actor.sub },
        include: { managedTeams: { include: { members: true } } },
      });
      const teamMemberIds = manager?.managedTeams.flatMap((t) =>
        t.members.map((m) => m.userId),
      ) ?? [];

      return {
        OR: [
          { departmentId: manager?.departmentId ?? undefined },
          ...(teamMemberIds.length ? [{ id: { in: teamMemberIds } }] : []),
        ],
      };
    }

    return { id: actor.sub };
  }

  private async assertAccess(targetUserId: string, actor: JwtPayload) {
    if (actor.role === UserRole.SUPER_ADMIN || actor.sub === targetUserId) return;

    if (actor.role === UserRole.MANAGER) {
      const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
      const manager = await this.prisma.user.findUnique({
        where: { id: actor.sub },
        include: { managedTeams: { include: { members: true } } },
      });
      const teamMemberIds = manager?.managedTeams.flatMap((t) =>
        t.members.map((m) => m.userId),
      ) ?? [];

      if (
        target?.departmentId === manager?.departmentId ||
        teamMemberIds.includes(targetUserId)
      ) {
        return;
      }
    }

    throw new ForbiddenException('Bu çalışanın verilerine erişim yetkiniz yok');
  }
}
