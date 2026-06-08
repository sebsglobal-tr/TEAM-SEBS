import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus, AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateUserDto, actor: JwtPayload) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Bu e-posta adresi zaten kullanılıyor');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role ?? UserRole.EMPLOYEE,
        departmentId: dto.departmentId,
        position: dto.position,
      },
      include: { department: true },
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.USER_CREATE,
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async findAll(actor: JwtPayload, filters?: {
    departmentId?: string;
    status?: UserStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where = await this.buildAccessFilter(actor, filters);

    if (filters?.search) {
      const s = filters.search.trim();
      (where as any).OR = [
        ...(Array.isArray(where['OR']) ? where['OR'] : []),
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }

    const isPaginated = !!filters?.page;
    const take = filters?.limit ?? 50;
    const skip = filters?.page ? (filters.page - 1) * take : undefined;

    const queryOpts: any = { where, include: { department: true }, orderBy: { createdAt: 'desc' as const } };
    if (isPaginated) {
      queryOpts.take = take;
      queryOpts.skip = skip;
    }

    const users = await this.prisma.user.findMany(queryOpts);
    const safe = users.map(({ passwordHash: _, ...u }) => u);

    if (isPaginated) {
      const total = await this.prisma.user.count({ where });
      return { data: safe, total, page: filters.page, limit: take };
    }

    return safe;
  }

  async findOne(id: string, actor: JwtPayload) {
    await this.assertAccess(id, actor);
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        department: true,
        teamMemberships: { include: { team: true } },
        assignedTasks: {
          where: { deletedAt: null },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        workSessions: {
          take: 10,
          orderBy: { startedAt: 'desc' },
        },
        uploadedFiles: {
          where: { deletedAt: null },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async update(id: string, dto: UpdateUserDto, actor: JwtPayload) {
    await this.assertAccess(id, actor);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      include: { department: true },
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.USER_UPDATE,
      entityType: 'User',
      entityId: id,
      metadata: dto as Prisma.InputJsonValue,
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async getManagers(actor: JwtPayload) {
    const managers = await this.prisma.user.findMany({
      where: {
        role: UserRole.MANAGER,
        deletedAt: null,
      },
      include: {
        _count: { select: { employees: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    return managers.map(({ passwordHash: _, ...m }) => m);
  }

  async getEmployees(
    actor: JwtPayload,
    filters?: { status?: UserStatus; search?: string; managerId?: string },
  ) {
    const where: Prisma.UserWhereInput = {
      role: UserRole.EMPLOYEE,
      deletedAt: null,
    };

    if (filters?.status) where.status = filters.status;
    if (filters?.managerId) where.managerId = filters.managerId;

    if (actor.role === UserRole.MANAGER) {
      // Manager can only see employees assigned to them
      where.managerId = actor.sub;
    }

    if (filters?.search) {
      const s = filters.search.trim();
      (where as any).OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: true,
      },
      orderBy: { firstName: 'asc' },
    });

    return users.map(({ passwordHash: _, ...u }) => u);
  }

  async activate(id: string, actor: JwtPayload) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE },
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async deactivate(id: string, actor: JwtPayload) {
    if (actor.sub === id) {
      throw new ForbiddenException('Kendi hesabınızı pasife alamazsınız');
    }

    await this.assertAccess(id, actor);
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
      include: { department: true },
    });

    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.USER_DEACTIVATE,
      entityType: 'User',
      entityId: id,
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  private async buildAccessFilter(
    actor: JwtPayload,
    filters?: { departmentId?: string; status?: UserStatus },
  ): Promise<Prisma.UserWhereInput> {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.status) where.status = filters.status;

    if (actor.role === UserRole.SUPER_ADMIN) return where;

    if (actor.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: { id: actor.sub },
        include: {
          managedDepartment: true,
          managedTeams: { include: { members: true } },
        },
      });

      const teamMemberIds = manager?.managedTeams.flatMap((t) =>
        t.members.map((m) => m.userId),
      ) ?? [];

      const departmentId = manager?.managedDepartment?.id ?? manager?.departmentId;

      where.OR = [
        { id: actor.sub },
        ...(departmentId ? [{ departmentId }] : []),
        ...(teamMemberIds.length ? [{ id: { in: teamMemberIds } }] : []),
      ];
      return where;
    }

    where.id = actor.sub;
    return where;
  }

  private async assertAccess(targetUserId: string, actor: JwtPayload) {
    if (actor.role === UserRole.SUPER_ADMIN) return;
    if (actor.sub === targetUserId) return;

    if (actor.role === UserRole.MANAGER) {
      const filter = await this.buildAccessFilter(actor);
      const user = await this.prisma.user.findFirst({
        where: { ...filter, id: targetUserId },
      });
      if (user) return;
    }

    throw new ForbiddenException('Bu kullanıcıya erişim yetkiniz yok');
  }
}
