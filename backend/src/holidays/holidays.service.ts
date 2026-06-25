import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class HolidaysService {
  constructor(private prisma: PrismaService) {}

  async create(dto: { name: string; date: string; type?: string; isHalfDay?: boolean }) {
    return this.prisma.holiday.create({
      data: {
        name: dto.name,
        date: new Date(dto.date),
        type: dto.type ?? 'PUBLIC',
        isHalfDay: dto.isHalfDay ?? false,
      },
    });
  }

  async findAll(year?: number) {
    const where: any = {};
    if (year) {
      where.date = {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31),
      };
    }
    return this.prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async remove(id: string) {
    await this.prisma.holiday.delete({ where: { id } });
    return { message: 'Tatil silindi' };
  }

  async isWorkingDay(date: Date): Promise<boolean> {
    const day = date.getDay();
    if (day === 0 || day === 6) return false; // weekend
    const holiday = await this.prisma.holiday.findFirst({
      where: {
        date: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        },
      },
    });
    return !holiday;
  }
}
