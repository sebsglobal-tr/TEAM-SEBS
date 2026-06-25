import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import {
  EmployeeStatus,
  WorkSessionStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * StatusSyncService — periyodik cron görevleri
 *
 * 1) OFFLINE işaretleme: {OFFLINE_THRESHOLD} dakikadır heartbeat gelmeyen kullanıcıları OFFLINE yap.
 * 2) Temizlik: 24 saatten eski PAUSED/ENDED oturumları kapat.
 *
 * NOT: Hareketsizlik kontrolü TAMAMEN İPTAL EDİLMİŞTİR.
 * Kullanıcı asla otomatik molaya/boşa düşürülmez, sayacı otomatik duraklatılmaz.
 * Sadece manuel duraklatma ve bitirme vardır.
 */
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

  /**
   * Her dakika: heartbeat'i kesilen kullanıcıları OFFLINE işaretle.
   * Bu sadece UI'daki durum bilgisini günceller, oturumu etkilemez.
   */
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
   * Saatte bir: 24 saatten eski PAUSED oturumları temizle (ENDED yap).
   * Bu, veritabanında biriken duraklatılmış oturumların şişmesini engeller.
   */
  @Cron('0 * * * *')
  async cleanupStalePausedSessions() {
    try {
      const threshold = new Date();
      threshold.setHours(threshold.getHours() - 24);

      const stalePaused = await this.prisma.workSession.findMany({
        where: {
          status: WorkSessionStatus.PAUSED,
          updatedAt: { lt: threshold },
        },
        take: 100,
      });

      if (stalePaused.length === 0) return;

      // Race condition önlemi: updateMany ile status kontrolü yap
      // Kullanıcı bu arada resume yapmışsa status PAUSED değildir, güncelleme olmaz
      const result = await this.prisma.workSession.updateMany({
        where: {
          id: { in: stalePaused.map(s => s.id) },
          status: WorkSessionStatus.PAUSED, // sadece hala PAUSED olanları güncelle
        },
        data: {
          status: WorkSessionStatus.ENDED,
          endedAt: threshold,
        },
      });

      this.logger.debug(`${result.count} eski duraklatılmış oturum kapatıldı`);
    } catch (error) {
      this.logger.error(`cleanupStalePausedSessions hatası: ${(error as Error).message}`);
    }
  }
}
