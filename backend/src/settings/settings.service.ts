import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRole, AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll() {
    const settings = await this.prisma.setting.findMany({
      orderBy: { key: 'asc' },
    });
    return settings;
  }

  async findByKey(key: string) {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) return null;
    return setting;
  }

  async upsert(key: string, value: string, actor: JwtPayload) {
    if (!key || !value) {
      throw new BadRequestException('Anahtar ve değer gereklidir');
    }

    const setting = await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.SETTING_UPDATE,
      entityType: 'Setting',
      entityId: key,
      metadata: { key, value } as Prisma.InputJsonValue,
    });

    return setting;
  }

  async bulkUpdate(
    entries: Array<{ key: string; value: string }>,
    actor: JwtPayload,
  ) {
    const results = [];
    for (const entry of entries) {
      const setting = await this.upsert(entry.key, entry.value, actor);
      results.push(setting);
    }
    return results;
  }
}
