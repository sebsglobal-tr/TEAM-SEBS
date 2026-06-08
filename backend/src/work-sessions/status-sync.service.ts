import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EmployeeStatus, WorkSessionStatus, ActivityEventType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class StatusSyncService {
  private readonly logger = new Logger(StatusSyncService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  private get offlineThresholdMinutes(): number {
    return parseInt(this.configService.get('OFFLINE_THRESHOLD_MINUTES', '3'), 10);
  }

  private get idleBreakThresholdMinutes(): number {
    return parseInt(this.configService.get('IDLE_BREAK_THRESHOLD_MINUTES', '3'), 10);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async syncOfflineUsers() {
    try {
      const threshold = new Date();
      threshold.setMinutes(threshold.getMinutes() - this.offlineThresholdMinutes);

      const staleUsers = await this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          currentStatus: {
            notIn: [EmployeeStatus.OFFLINE, EmployeeStatus.WORK_SESSION_ENDED],
          },
          OR: [
            { lastActiveAt: { lt: threshold } },
            { lastActiveAt: null },
          ],
        },
      });

      for (const user of staleUsers) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { currentStatus: EmployeeStatus.OFFLINE },
        });
      }

      if (staleUsers.length > 0) {
        this.logger.debug(`${staleUsers.length} kullanıcı çevrimdışı işaretlendi`);
      }
    } catch (error) {
      this.logger.error(`syncOfflineUsers hatası (geçici): ${(error as Error).message}`);
    }
  }

  /**
   * Safety net: Users who are idle (ONLINE_IDLE) for 3+ minutes
   * get auto-placed on break. This is a backup for when the
   * frontend idle detection doesn't fire.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async autoBreakIdleUsers() {
    try {
      const threshold = new Date();
      threshold.setMinutes(threshold.getMinutes() - this.idleBreakThresholdMinutes);

      // Find active sessions where user has been idle too long
      const idleSessions = await this.prisma.workSession.findMany({
        where: {
          status: WorkSessionStatus.ACTIVE,
          user: {
            status: 'ACTIVE',
            currentStatus: { in: [EmployeeStatus.ONLINE_IDLE, EmployeeStatus.OFFLINE] },
            lastActiveAt: { lt: threshold },
          },
        },
        include: {
          user: true,
          breaks: {
            where: { endedAt: null },
            take: 1,
          },
        },
      });

      for (const session of idleSessions) {
        // Skip if already on break
        if (session.breaks.length > 0) continue;

        const now = new Date();
        await this.prisma.break.create({
          data: {
            userId: session.userId,
            workSessionId: session.id,
            startedAt: now,
          },
        });

        await this.prisma.activityEvent.create({
          data: {
            userId: session.userId,
            workSessionId: session.id,
            type: ActivityEventType.BREAK_START,
            timestamp: now,
            metadata: { source: 'auto-idle-break' },
          },
        });

        await this.prisma.user.update({
          where: { id: session.userId },
          data: { currentStatus: EmployeeStatus.ON_BREAK, lastActiveAt: now },
        });

        this.logger.debug(
          `Auto-break: ${session.user.firstName} ${session.user.lastName} (${session.userId}) — ${this.idleBreakThresholdMinutes}dk hareketsiz`,
        );
      }

      // Auto-end breaks for users who became active again
      const breakThreshold = new Date();
      breakThreshold.setMinutes(breakThreshold.getMinutes() - this.idleBreakThresholdMinutes);

      const autoBreaks = await this.prisma.break.findMany({
        where: {
          endedAt: null,
          user: {
            status: 'ACTIVE',
            currentStatus: EmployeeStatus.ON_BREAK,
            lastActiveAt: { gte: breakThreshold },
          },
        },
        include: {
          user: true,
          workSession: true,
        },
      });

      for (const brk of autoBreaks) {
        const now = new Date();
        const duration = Math.floor((now.getTime() - brk.startedAt.getTime()) / 1000);

        await this.prisma.break.update({
          where: { id: brk.id },
          data: { endedAt: now, durationSeconds: duration },
        });

        await this.prisma.workSession.update({
          where: { id: brk.workSessionId },
          data: { totalBreakSeconds: { increment: duration } },
        });

        await this.prisma.activityEvent.create({
          data: {
            userId: brk.userId,
            workSessionId: brk.workSessionId,
            type: ActivityEventType.BREAK_END,
            durationSeconds: duration,
            metadata: { source: 'auto-idle-break-end' },
          },
        });

        await this.prisma.user.update({
          where: { id: brk.userId },
          data: { currentStatus: EmployeeStatus.ONLINE_ACTIVE },
        });

        this.logger.debug(
          `Auto-break-end: ${brk.user.firstName} ${brk.user.lastName} — ${duration}s`,
        );
      }
    } catch (error) {
      this.logger.error(`autoBreakIdleUsers hatası (geçici): ${(error as Error).message}`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async closeStaleSessions() {
    try {
      const threshold = new Date();
      threshold.setMinutes(threshold.getMinutes() - 5);

      const staleSessions = await this.prisma.workSession.findMany({
        where: {
          status: WorkSessionStatus.ACTIVE,
          heartbeats: { none: { timestamp: { gte: threshold } } },
          activityEvents: { none: { timestamp: { gte: threshold }, type: 'SESSION_START' } },
        },
        include: {
          heartbeats: { orderBy: { timestamp: 'desc' }, take: 1 },
          activityEvents: { orderBy: { timestamp: 'desc' }, take: 1 },
        },
      });

      const toClose = staleSessions.filter((s) => {
        const lastHb = s.heartbeats[0]?.timestamp;
        const lastEv = s.activityEvents[0]?.timestamp;
        const lastActivity = lastHb && lastEv
          ? (lastHb > lastEv ? lastHb : lastEv)
          : (lastHb ?? lastEv);
        return !lastActivity || lastActivity < threshold;
      });

      for (const session of toClose) {
        await this.prisma.workSession.update({
          where: { id: session.id },
          data: { status: WorkSessionStatus.ENDED, endedAt: new Date() },
        });
        await this.prisma.user.update({
          where: { id: session.userId },
          data: { currentStatus: EmployeeStatus.OFFLINE },
        });
      }

      if (toClose.length > 0) {
        this.logger.debug(`${toClose.length} eski oturum kapatıldı`);
      }
    } catch (error) {
      this.logger.error(`closeStaleSessions hatası (geçici): ${(error as Error).message}`);
    }
  }
}
