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

/** Manuel duraklatma */

/**
 * Yardımcı: aktif bir oturumun "şu anki" toplam aktif saniyesini hesaplar.
 * Hem veritabanındaki kayıtlı totalActiveSeconds değerini,
 * hem de son resumedAt/startedAt'ten bu yana geçen süreyi kullanır.
 */
function computeActiveSeconds(session: {
  startedAt: Date;
  lastResumedAt: Date | null;
  totalActiveSeconds: number;
}): number {
  const baseMs = (session.lastResumedAt ?? session.startedAt).getTime();
  const elapsedSinceLastResume = Math.max(0, Date.now() - baseMs);
  return session.totalActiveSeconds + Math.floor(elapsedSinceLastResume / 1000);
}

@Injectable()
export class WorkSessionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────
  //  START / RESUME
  // ──────────────────────────────────────────────

  /**
   * Çalışma oturumunu başlat (veya duraklatılmış oturumu devam ettir).
   * Eğer zaten ACTIVE bir oturum varsa onu döndürür (hata fırlatmaz).
   */
  async start(userId: string) {
    // 1) Zaten ACTIVE oturum → kontrol et
    const active = await this.prisma.workSession.findFirst({
      where: { userId, status: WorkSessionStatus.ACTIVE },
      orderBy: { updatedAt: 'desc' },
    });
    if (active) {
      // 4 saatten eski aktif oturum → terk edilmiş say, kapat ve yeni oluştur
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      if (active.updatedAt < fourHoursAgo) {
        const now = new Date();
        // Eski oturumu kapat
        const baseTime = (active.lastResumedAt ?? active.startedAt).getTime();
        const elapsedSinceResume = Math.max(0, Math.floor((now.getTime() - baseTime) / 1000));
        await this.prisma.workSession.update({
          where: { id: active.id },
          data: {
            status: WorkSessionStatus.ENDED,
            endedAt: now,
            totalActiveSeconds: active.totalActiveSeconds + elapsedSinceResume,
          },
        });
        // Yeni oturum oluştur (aşağıdaki kod devam eder)
      } else {
        return active; // 4 saatten yeni, hala geçerli
      }
    }

    // 2) PAUSED / AUTO_PAUSED oturum → resume et
    const paused = await this.prisma.workSession.findFirst({
      where: {
        userId,
        status: { in: [WorkSessionStatus.PAUSED, WorkSessionStatus.AUTO_PAUSED] },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (paused) {
      const now = new Date();
      const resumed = await this.prisma.workSession.update({
        where: { id: paused.id },
        data: {
          status: WorkSessionStatus.ACTIVE,
          lastResumedAt: now,
          pausedAt: null,
          pauseReason: null,
          lastActivityAt: now,
        },
      });

      await this.prisma.activityEvent.create({
        data: {
          userId,
          workSessionId: resumed.id,
          type: ActivityEventType.SESSION_START,
          timestamp: now,
          metadata: { resumeFrom: paused.status },
        },
      });

      await this.prisma.user.update({
        where: { id: userId },
        data: { currentStatus: EmployeeStatus.ONLINE_ACTIVE, lastActiveAt: now },
      });

      return resumed;
    }

    // 3) Hiç oturum yok → yeni oluştur
    const now = new Date();
    const session = await this.prisma.workSession.create({
      data: {
        userId,
        status: WorkSessionStatus.ACTIVE,
        lastResumedAt: now,
        lastActivityAt: now,
      },
    });

    await this.prisma.activityEvent.create({
      data: {
        userId,
        workSessionId: session.id,
        type: ActivityEventType.SESSION_START,
        timestamp: now,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { currentStatus: EmployeeStatus.ONLINE_ACTIVE, lastActiveAt: now },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.SESSION_START,
      entityType: 'WorkSession',
      entityId: session.id,
    });

    return session;
  }

  // ──────────────────────────────────────────────
  //  PAUSE (manuel)
  // ──────────────────────────────────────────────

  async pause(userId: string, reason: string = 'manual') {
    const session = await this.prisma.workSession.findFirst({
      where: { userId, status: WorkSessionStatus.ACTIVE },
    });
    if (!session) {
      throw new NotFoundException('Aktif çalışma oturumu bulunamadı');
    }

    const now = new Date();
    const baseTime = (session.lastResumedAt ?? session.startedAt).getTime();
    const elapsedSinceLastResume = Math.max(0, Math.floor((now.getTime() - baseTime) / 1000));

    await this.prisma.workSession.update({
      where: { id: session.id },
      data: {
        status: WorkSessionStatus.PAUSED,
        pausedAt: now,
        pauseReason: reason,
        totalActiveSeconds: session.totalActiveSeconds + elapsedSinceLastResume,
        lastActivityAt: now,
      },
    });

    await this.prisma.activityEvent.create({
      data: {
        userId,
        workSessionId: session.id,
        type: ActivityEventType.SCREEN_LOCK,
        timestamp: now,
        durationSeconds: elapsedSinceLastResume,
        metadata: { pauseReason: reason, totalAfterPause: session.totalActiveSeconds + elapsedSinceLastResume },
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: now },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.SCREEN_LOCK,
      entityType: 'WorkSession',
      entityId: session.id,
    });

    return {
      sessionId: session.id,
      status: WorkSessionStatus.PAUSED,
      totalActiveSeconds: session.totalActiveSeconds + elapsedSinceLastResume,
      pauseReason: reason,
    };
  }

  // ──────────────────────────────────────────────
  //  RESUME (duraklatılmış oturumu devam ettir)
  // ──────────────────────────────────────────────

  async resume(userId: string) {
    const session = await this.prisma.workSession.findFirst({
      where: {
        userId,
        status: { in: [WorkSessionStatus.PAUSED, WorkSessionStatus.AUTO_PAUSED] },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!session) {
      throw new NotFoundException('Duraklatılmış çalışma oturumu bulunamadı');
    }

    const now = new Date();
    const resumed = await this.prisma.workSession.update({
      where: { id: session.id },
      data: {
        status: WorkSessionStatus.ACTIVE,
        lastResumedAt: now,
        pausedAt: null,
        pauseReason: null,
        lastActivityAt: now,
      },
    });

    await this.prisma.activityEvent.create({
      data: {
        userId,
        workSessionId: resumed.id,
        type: ActivityEventType.ACTIVE,
        timestamp: now,
        metadata: { resumedFrom: session.status, pauseDuration: session.pausedAt ? Math.floor((now.getTime() - session.pausedAt.getTime()) / 1000) : 0 },
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { currentStatus: EmployeeStatus.ONLINE_ACTIVE, lastActiveAt: now },
    });

    return resumed;
  }

  // ──────────────────────────────────────────────
  //  STOP (oturumu tamamen bitir)
  // ──────────────────────────────────────────────

  async stop(userId: string) {
    const session = await this.prisma.workSession.findFirst({
      where: { userId, status: { not: WorkSessionStatus.ENDED } },
      orderBy: { updatedAt: 'desc' },
    });
    if (!session) {
      throw new NotFoundException('Aktif veya duraklatılmış çalışma oturumu bulunamadı');
    }

    const now = new Date();
    let finalActiveSeconds = session.totalActiveSeconds;

    // Eğer ACTIVE ise, son resumedAt/startedAt'ten bu yana geçen süreyi de ekle
    if (session.status === WorkSessionStatus.ACTIVE) {
      const baseTime = (session.lastResumedAt ?? session.startedAt).getTime();
      finalActiveSeconds += Math.max(0, Math.floor((now.getTime() - baseTime) / 1000));
    }

    const ended = await this.prisma.workSession.update({
      where: { id: session.id },
      data: {
        status: WorkSessionStatus.ENDED,
        endedAt: now,
        totalActiveSeconds: finalActiveSeconds,
        lastActivityAt: now,
      },
    });

    await this.prisma.activityEvent.create({
      data: {
        userId,
        workSessionId: session.id,
        type: ActivityEventType.SESSION_END,
        timestamp: now,
        durationSeconds: finalActiveSeconds,
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

    // Yöneticiye bildirim
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

  // ──────────────────────────────────────────────
  //  GET TODAY — gerçek zaman damgalarına göre hesaplama
  // ──────────────────────────────────────────────

  async getToday(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Bugünün oturumları (günlük toplam süre için)
    const sessions = await this.prisma.workSession.findMany({
      where: { userId, startedAt: { gte: startOfDay } },
      orderBy: { startedAt: 'desc' },
    });

    // Aktif oturum: TARİH FİLTRESİZ — dün/önceki gün başlamış da olabilir
    const activeSession = await this.prisma.workSession.findFirst({
      where: {
        userId,
        status: WorkSessionStatus.ACTIVE,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Günlük toplam süre (bugünün oturumları üzerinden)
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

    // Eğer aktif oturum BUGÜN başlamadıysa (dünden kalmış), onun süresini de ekle
    if (activeSession && activeSession.startedAt < startOfDay) {
      const baseTime = (activeSession.lastResumedAt ?? activeSession.startedAt).getTime();
      const activeSecs = activeSession.totalActiveSeconds +
        Math.max(0, Math.floor((Date.now() - baseTime) / 1000));
      totals.active += activeSecs;
    }

    // Aktif mola var mı?
    const onBreak = activeSession
      ? await this.prisma.break.findFirst({
          where: { userId, workSessionId: activeSession.id, endedAt: null },
        })
      : null;

    return { sessions, totals, activeSession, isOnBreak: !!onBreak };
  }

  // ──────────────────────────────────────────────
  //  HEARTBEAT — canlılık sinyali + otomatik duraklatma kontrolü
  // ──────────────────────────────────────────────

  async sendHeartbeat(userId: string, status: EmployeeStatus = EmployeeStatus.ONLINE_ACTIVE) {
    const session = await this.prisma.workSession.findFirst({
      where: { userId, status: WorkSessionStatus.ACTIVE },
    });
    if (!session) {
      throw new BadRequestException('Aktif çalışma oturumu yok');
    }

    const now = new Date();

    // Aktif mola kontrolü (sadece manuel)
    const onBreak = await this.prisma.break.findFirst({
      where: { userId, workSessionId: session.id, endedAt: null },
    });
    const effectiveStatus = onBreak ? EmployeeStatus.ON_BREAK : status;

    // Heartbeat kaydı (süre hesaplamaz — sadece canlılık sinyali)
    await this.prisma.heartbeat.create({
      data: {
        userId,
        workSessionId: session.id,
        status: effectiveStatus,
        clientVersion: 'web-1.0',
      },
    });

    // Son aktivite zamanını güncelle (cron'un auto-pause kararı için)
    await this.prisma.workSession.update({
      where: { id: session.id },
      data: { lastActivityAt: now },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { currentStatus: effectiveStatus, lastActiveAt: now },
    });

    // NOT: Otomatik duraklatma/boşa düşürme YOKTUR. Tüm işlemler manueldir.

    return {
      sessionId: session.id,
      status: WorkSessionStatus.ACTIVE,
      effectiveStatus,
      currentActiveSeconds: computeActiveSeconds(session),
    };
  }

  // ──────────────────────────────────────────────
  //  SYNC — pagehide / sendBeacon için (oturum kapatmaz, sadece son durumu kaydeder)
  // ──────────────────────────────────────────────

  async syncSession(userId: string) {
    const session = await this.prisma.workSession.findFirst({
      where: { userId, status: WorkSessionStatus.ACTIVE },
    });
    if (!session) return null;

    const now = new Date();

    // Son heartbeat kaydı
    await this.prisma.heartbeat.create({
      data: {
        userId,
        workSessionId: session.id,
        status: EmployeeStatus.ONLINE_ACTIVE,
        clientVersion: 'web-sync',
      },
    });

    await this.prisma.workSession.update({
      where: { id: session.id },
      data: { lastActivityAt: now },
    });

    return { sessionId: session.id, syncedAt: now.toISOString() };
  }

  // ──────────────────────────────────────────────
  //  BREAK MANAGEMENT (değişmedi)
  // ──────────────────────────────────────────────

  async startBreak(userId: string) {
    const session = await this.getActiveSession(userId);
    const activeBreak = await this.prisma.break.findFirst({
      where: { userId, workSessionId: session.id, endedAt: null },
    });
    if (activeBreak) {
      throw new BadRequestException('Zaten moladasınız');
    }

    // Molaya çıkmadan önceki aktif süreyi snapshot'la
    const now = new Date();
    const baseTime = (session.lastResumedAt ?? session.startedAt).getTime();
    const elapsedSinceResume = Math.max(0, Math.floor((now.getTime() - baseTime) / 1000));
    await this.prisma.workSession.update({
      where: { id: session.id },
      data: {
        totalActiveSeconds: session.totalActiveSeconds + elapsedSinceResume,
        lastResumedAt: now,
      },
    });

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
      data: {
        totalBreakSeconds: { increment: duration },
        lastResumedAt: now, // Moladan dönüşte aktif süre sayacını sıfırla
      },
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

  // ──────────────────────────────────────────────
  //  GETTERS (dashboard, reports, timeline — değişmedi)
  // ──────────────────────────────────────────────

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

  async getDailyBreakdown(filters: {
    startDate: Date;
    endDate: Date;
    userId?: string;
  }) {
    const where: Record<string, unknown> = {
      startedAt: { gte: filters.startDate, lte: filters.endDate },
    };
    if (filters.userId) where.userId = filters.userId;

    const sessions = await this.prisma.workSession.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
      orderBy: { startedAt: 'asc' },
    });

    // Group by user + date
    const dailyMap = new Map<string, {
      userId: string;
      employeeName: string;
      department?: string;
      date: string;
      totalActiveSeconds: number;
      totalBreakSeconds: number;
      totalIdleSeconds: number;
      sessionCount: number;
    }>();

    for (const s of sessions) {
      const dateKey = s.startedAt.toISOString().split('T')[0];
      const mapKey = `${s.userId}_${dateKey}`;
      const existing = dailyMap.get(mapKey) ?? {
        userId: s.userId,
        employeeName: `${s.user.firstName} ${s.user.lastName}`,
        department: s.user.department?.name,
        date: dateKey,
        totalActiveSeconds: 0,
        totalBreakSeconds: 0,
        totalIdleSeconds: 0,
        sessionCount: 0,
      };

      // Eğer oturum hala ACTIVE ise gerçek süreyi hesapla
      let activeSecs = s.totalActiveSeconds;
      if (s.status === 'ACTIVE') {
        const baseTime = (s.lastResumedAt ?? s.startedAt).getTime();
        activeSecs += Math.max(0, Math.floor((Date.now() - baseTime) / 1000));
      }

      existing.totalActiveSeconds += activeSecs;
      existing.totalBreakSeconds += s.totalBreakSeconds;
      existing.totalIdleSeconds += s.totalIdleSeconds;
      existing.sessionCount += 1;
      dailyMap.set(mapKey, existing);
    }

    return Array.from(dailyMap.values());
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
        (acc: any, s: any) => {
          let activeSecs = s.totalActiveSeconds;
          // ACTIVE oturum için canlı hesaplama
          if (s.status === 'ACTIVE') {
            const baseTime = (s.lastResumedAt ?? s.startedAt)?.getTime() ?? Date.now();
            activeSecs += Math.max(0, Math.floor((Date.now() - baseTime) / 1000));
          }
          return {
            active: acc.active + activeSecs,
            idle: acc.idle + (s.totalIdleSeconds ?? 0),
            break: acc.break + (s.totalBreakSeconds ?? 0),
            locked: acc.locked + (s.totalLockedSeconds ?? 0),
          };
        },
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

  /** Duraklatılmış bir oturumu bul (frontend'in "devam et" butonu göstermesi için) */
  async getPausedSession(userId: string) {
    return this.prisma.workSession.findFirst({
      where: {
        userId,
        status: { in: [WorkSessionStatus.PAUSED, WorkSessionStatus.AUTO_PAUSED] },
      },
      orderBy: { updatedAt: 'desc' },
    });
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

  // ──────────────────────────────────────────────
  //  PRIVATE HELPERS
  // ──────────────────────────────────────────────

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
