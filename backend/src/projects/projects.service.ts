import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: { name: string; description?: string; color?: string; startDate?: string; endDate?: string }, actor: JwtPayload) {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        color: dto.color ?? '#7c3aed',
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        createdById: actor.sub,
      },
      include: { _count: { select: { tasks: true } } },
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        tasks: {
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { tasks: true } },
      },
    });
    if (!project) throw new NotFoundException('Proje bulunamadı');
    return project;
  }

  async update(id: string, dto: { name?: string; description?: string; status?: string; color?: string }) {
    return this.prisma.project.update({ where: { id }, data: dto });
  }
}
