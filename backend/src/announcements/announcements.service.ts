import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: { title: string; content: string; priority?: string; targetRole?: string }, actor: JwtPayload) {
    if (actor.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('Duyuru oluşturma yetkiniz yok');
    }
    return this.prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        priority: dto.priority ?? 'NORMAL',
        targetRole: dto.targetRole ?? 'ALL',
        authorId: actor.sub,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
  }

  async findAll(actor: JwtPayload) {
    const where: any = {};
    if (actor.role === UserRole.EMPLOYEE) {
      where.OR = [{ targetRole: 'ALL' }, { targetRole: 'EMPLOYEE' }];
    } else if (actor.role === UserRole.MANAGER) {
      where.OR = [{ targetRole: 'ALL' }, { targetRole: 'MANAGER' }, { targetRole: 'EMPLOYEE' }];
    }
    return this.prisma.announcement.findMany({
      where,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async remove(id: string, actor: JwtPayload) {
    const announcement = await this.prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw new NotFoundException('Duyuru bulunamadı');
    if (actor.role !== UserRole.SUPER_ADMIN && announcement.authorId !== actor.sub) {
      throw new ForbiddenException('Bu duyuruyu silemezsiniz');
    }
    await this.prisma.announcement.delete({ where: { id } });
    return { message: 'Duyuru silindi' };
  }
}
