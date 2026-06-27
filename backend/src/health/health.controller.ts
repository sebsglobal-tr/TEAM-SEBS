import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const dbMs = Date.now() - start;
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        db: { connected: true, latencyMs: dbMs },
      };
    } catch (err) {
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        db: { connected: false, error: (err as Error).message },
      };
    }
  }
}
