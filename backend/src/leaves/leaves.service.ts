import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRole, LeaveStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class LeavesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: { leaveType: string; startDate: string; endDate: string; reason?: string }, actor: JwtPayload) {
    return this.prisma.leaveRequest.create({
      data: {
        userId: actor.sub,
        leaveType: dto.leaveType as any,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        reason: dto.reason,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async findAll(actor: JwtPayload) {
    const where: any = {};
    if (actor.role === UserRole.EMPLOYEE) {
      where.userId = actor.sub;
    } else if (actor.role === UserRole.MANAGER) {
      where.user = { managerId: actor.sub };
    }
    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async updateStatus(id: string, status: string, rejectionReason: string | undefined, actor: JwtPayload) {
    if (actor.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('İzin talebini onaylama yetkiniz yok');
    }
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('İzin talebi bulunamadı');

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: status as LeaveStatus,
        approvedById: status === 'APPROVED' ? actor.sub : undefined,
        approvedAt: status === 'APPROVED' ? new Date() : undefined,
        rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
