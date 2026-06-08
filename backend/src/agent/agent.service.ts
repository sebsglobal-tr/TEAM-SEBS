import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmployeeStatus,
  ActivityEventType,
  WorkSessionStatus,
  AuditAction,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { AgentEventDto } from './dto/agent-event.dto';

const STATUS_TO_AUDIT: Partial<Record<ActivityEventType, AuditAction>> = {
  [ActivityEventType.IDLE]: AuditAction.IDLE,
  [ActivityEventType.ACTIVE]: AuditAction.ACTIVE,
  [ActivityEventType.SCREEN_LOCK]: AuditAction.SCREEN_LOCK,
  [ActivityEventType.SCREEN_UNLOCK]: AuditAction.SCREEN_UNLOCK,
  [ActivityEventType.BREAK_START]: AuditAction.BREAK_START,
  [ActivityEventType.BREAK_END]: AuditAction.BREAK_END,
};

@Injectable()
export class AgentService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  async processHeartbeat(userId: string, dto: HeartbeatDto) {
    const heartbeat = await this.prisma.heartbeat.create({
      data: {
        userId,
        workSessionId: dto.workSessionId,
        status: dto.status,
        idleSeconds: dto.idleSeconds ?? 0,
        clientVersion: dto.clientVersion,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        currentStatus: dto.status,
        lastActiveAt: new Date(),
      },
    });

    if (dto.workSessionId) {
      await this.updateSessionTotals(dto.workSessionId, dto.status, 30);
    }

    return heartbeat;
  }

  async processEvent(userId: string, dto: AgentEventDto) {
    const timestamp = dto.timestamp ? new Date(dto.timestamp) : new Date();

    const event = await this.prisma.activityEvent.create({
      data: {
        userId,
        workSessionId: dto.workSessionId,
        type: dto.type,
        durationSeconds: dto.durationSeconds ?? 0,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        timestamp,
      },
    });

    const statusMap: Partial<Record<ActivityEventType, EmployeeStatus>> = {
      [ActivityEventType.ACTIVE]: EmployeeStatus.ONLINE_ACTIVE,
      [ActivityEventType.IDLE]: EmployeeStatus.ONLINE_IDLE,
      [ActivityEventType.SCREEN_LOCK]: EmployeeStatus.SCREEN_LOCKED,
      [ActivityEventType.BREAK_START]: EmployeeStatus.ON_BREAK,
      [ActivityEventType.BREAK_END]: EmployeeStatus.ONLINE_ACTIVE,
      [ActivityEventType.OFFLINE]: EmployeeStatus.OFFLINE,
    };

    if (statusMap[dto.type]) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { currentStatus: statusMap[dto.type], lastActiveAt: timestamp },
      });
    }

    if (dto.type === ActivityEventType.BREAK_START && dto.workSessionId) {
      await this.prisma.break.create({
        data: { userId, workSessionId: dto.workSessionId },
      });
    }

    if (dto.type === ActivityEventType.BREAK_END && dto.workSessionId) {
      const activeBreak = await this.prisma.break.findFirst({
        where: { userId, workSessionId: dto.workSessionId, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });
      if (activeBreak) {
        const duration = Math.floor((timestamp.getTime() - activeBreak.startedAt.getTime()) / 1000);
        await this.prisma.break.update({
          where: { id: activeBreak.id },
          data: { endedAt: timestamp, durationSeconds: duration },
        });
        await this.updateSessionTotals(dto.workSessionId, EmployeeStatus.ON_BREAK, duration);
      }
    }

    const auditAction = STATUS_TO_AUDIT[dto.type];
    if (auditAction) {
      await this.auditService.log({
        actorId: userId,
        action: auditAction,
        entityType: 'WorkSession',
        entityId: dto.workSessionId,
        metadata: { type: dto.type, durationSeconds: dto.durationSeconds },
      });
    }

    if (dto.workSessionId && dto.durationSeconds) {
      const statusForDuration = this.eventTypeToStatus(dto.type);
      if (statusForDuration) {
        await this.updateSessionTotals(dto.workSessionId, statusForDuration, dto.durationSeconds);
      }
    }

    return event;
  }

  async sync(userId: string, heartbeats: HeartbeatDto[], events: AgentEventDto[]) {
    const results = { heartbeats: 0, events: 0 };

    for (const hb of heartbeats) {
      await this.processHeartbeat(userId, hb);
      results.heartbeats++;
    }

    for (const ev of events) {
      await this.processEvent(userId, ev);
      results.events++;
    }

    return { message: 'Senkronizasyon tamamlandı', ...results };
  }

  async getSettings() {
    const settings = await this.prisma.setting.findMany();
    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    return {
      idleThresholdMinutes: parseInt(
        settingsMap['idle_threshold_minutes'] ??
          this.configService.get('DEFAULT_IDLE_THRESHOLD_MINUTES', '10'),
        10,
      ),
      heartbeatIntervalSeconds: parseInt(
        settingsMap['heartbeat_interval_seconds'] ??
          this.configService.get('HEARTBEAT_INTERVAL_SECONDS', '30'),
        10,
      ),
      offlineThresholdMinutes: parseInt(
        settingsMap['offline_threshold_minutes'] ??
          this.configService.get('OFFLINE_THRESHOLD_MINUTES', '3'),
        10,
      ),
    };
  }

  async closeStaleSessions() {
    const threshold = new Date();
    threshold.setMinutes(threshold.getMinutes() - 5);

    const staleSessions = await this.prisma.workSession.findMany({
      where: {
        status: WorkSessionStatus.ACTIVE,
        heartbeats: { none: { timestamp: { gte: threshold } } },
      },
    });

    for (const session of staleSessions) {
      await this.prisma.workSession.update({
        where: { id: session.id },
        data: { status: WorkSessionStatus.ENDED, endedAt: new Date() },
      });
      await this.prisma.user.update({
        where: { id: session.userId },
        data: { currentStatus: EmployeeStatus.OFFLINE },
      });
    }

    return { closed: staleSessions.length };
  }

  private async updateSessionTotals(
    sessionId: string,
    status: EmployeeStatus,
    seconds: number,
  ) {
    const session = await this.prisma.workSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== WorkSessionStatus.ACTIVE) return;

    const fieldMap: Partial<Record<EmployeeStatus, string>> = {
      [EmployeeStatus.ONLINE_ACTIVE]: 'totalActiveSeconds',
      [EmployeeStatus.ONLINE_IDLE]: 'totalIdleSeconds',
      [EmployeeStatus.ON_BREAK]: 'totalBreakSeconds',
      [EmployeeStatus.SCREEN_LOCKED]: 'totalLockedSeconds',
      [EmployeeStatus.OFFLINE]: 'totalOfflineSeconds',
    };

    const field = fieldMap[status];
    if (!field) return;

    await this.prisma.workSession.update({
      where: { id: sessionId },
      data: { [field]: { increment: seconds } },
    });
  }

  private eventTypeToStatus(type: ActivityEventType): EmployeeStatus | null {
    const map: Partial<Record<ActivityEventType, EmployeeStatus>> = {
      [ActivityEventType.ACTIVE]: EmployeeStatus.ONLINE_ACTIVE,
      [ActivityEventType.IDLE]: EmployeeStatus.ONLINE_IDLE,
      [ActivityEventType.SCREEN_LOCK]: EmployeeStatus.SCREEN_LOCKED,
      [ActivityEventType.BREAK_START]: EmployeeStatus.ON_BREAK,
      [ActivityEventType.OFFLINE]: EmployeeStatus.OFFLINE,
    };
    return map[type] ?? null;
  }
}
