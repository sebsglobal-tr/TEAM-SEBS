import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateDepartmentDto, actor: JwtPayload) {
    const existing = await this.prisma.department.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Bu departman adı zaten mevcut');

    const department = await this.prisma.department.create({
      data: dto,
      include: { manager: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.DEPARTMENT_CREATE,
      entityType: 'Department',
      entityId: department.id,
    });

    return department;
  }

  async findAll() {
    return this.prisma.department.findMany({
      where: { deletedAt: null },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { members: true, teams: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        members: {
          where: { deletedAt: null },
          select: { id: true, firstName: true, lastName: true, email: true, position: true, currentStatus: true },
        },
        teams: {
          where: { deletedAt: null },
          include: {
            manager: { select: { id: true, firstName: true, lastName: true } },
            _count: { select: { members: true } },
          },
        },
      },
    });

    if (!department) throw new NotFoundException('Departman bulunamadı');
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto, actor: JwtPayload) {
    const department = await this.prisma.department.update({
      where: { id },
      data: dto,
      include: { manager: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.DEPARTMENT_UPDATE,
      entityType: 'Department',
      entityId: id,
    });

    return department;
  }

  async remove(id: string, actor: JwtPayload) {
    await this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.DEPARTMENT_DELETE,
      entityType: 'Department',
      entityId: id,
    });

    return { message: 'Departman pasife alındı' };
  }

  async createTeam(dto: CreateTeamDto, actor: JwtPayload) {
    const team = await this.prisma.team.create({
      data: dto,
      include: {
        department: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return team;
  }

  async addTeamMember(teamId: string, userId: string) {
    return this.prisma.teamMember.create({
      data: { teamId, userId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }
}
