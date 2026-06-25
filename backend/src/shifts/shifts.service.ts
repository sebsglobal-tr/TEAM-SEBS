import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: { userId: string; type: string; date: string; startTime: string; endTime?: string }) {
    return this.prisma.shift.create({
      data: {
        userId: dto.userId,
        type: dto.type as any,
        date: new Date(dto.date),
        startTime: new Date(dto.startTime),
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async getByDateRange(startDate: string, endDate: string) {
    return this.prisma.shift.findMany({
      where: { date: { gte: new Date(startDate), lte: new Date(endDate) } },
      include: { user: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  async getMyShifts(userId: string) {
    return this.prisma.shift.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 60,
    });
  }
}
