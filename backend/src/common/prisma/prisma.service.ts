import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? (['warn', 'error'] as any) : (['error'] as any),
      // Connection pool ayarları: Supabase PgBouncer için 17 limit
      // Geliştirmede daha az bağlantı kullanarak pool tükenmesini önle
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      console.error('Prisma bağlantı hatası (onModuleInit):', (error as Error).message);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
