import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  constructor(private prisma: PrismaService) {}

  async create(url: string, events: string[], actorId: string) {
    return this.prisma.webhook.create({ data: { url, events, createdById: actorId } });
  }

  async findAll() {
    return this.prisma.webhook.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async remove(id: string) {
    const wh = await this.prisma.webhook.findUnique({ where: { id } });
    if (!wh) throw new NotFoundException('Webhook bulunamadı');
    await this.prisma.webhook.delete({ where: { id } });
    return { message: 'Webhook silindi' };
  }

  async notify(event: string, payload: any) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { events: { has: event } },
    });
    for (const wh of webhooks) {
      try {
        await fetch(wh.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Webhook-Event': event },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        });
      } catch (err: any) {
        this.logger.warn(`Webhook çağrısı başarısız: ${wh.url} - ${err.message}`);
      }
    }
  }
}
