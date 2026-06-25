import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async create(name: string, actor: JwtPayload) {
    return this.prisma.groupChat.create({
      data: {
        name,
        createdById: actor.sub,
        members: { create: { userId: actor.sub } },
      },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        _count: { select: { members: true, messages: true } },
      },
    });
  }

  async findAll(actor: JwtPayload) {
    return this.prisma.groupChat.findMany({
      where: { members: { some: { userId: actor.sub } } },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        _count: { select: { members: true, messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addMember(groupId: string, userId: string, actor: JwtPayload) {
    const group = await this.prisma.groupChat.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grup bulunamadı');
    if (group.createdById !== actor.sub) throw new ForbiddenException('Sadece grup sahibi üye ekleyebilir');
    return this.prisma.groupMember.create({ data: { groupId, userId } });
  }

  async sendMessage(groupId: string, message: string, actor: JwtPayload) {
    const isMember = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: actor.sub } },
    });
    if (!isMember) throw new ForbiddenException('Bu grupta mesaj gönderme yetkiniz yok');
    return this.prisma.groupMessage.create({
      data: { groupId, senderId: actor.sub, message },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async getMessages(groupId: string, actor: JwtPayload) {
    const isMember = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: actor.sub } },
    });
    if (!isMember) throw new ForbiddenException('Bu gruba erişim yetkiniz yok');
    return this.prisma.groupMessage.findMany({
      where: { groupId },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }
}
