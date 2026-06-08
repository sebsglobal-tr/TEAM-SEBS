import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  UserRole,
  TaskStatus,
  AuditAction,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateTaskDto, actor: JwtPayload) {
    const task = await this.prisma.task.create({
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        createdById: actor.sub,
      },
      include: this.taskIncludes(),
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.TASK_CREATE,
      entityType: 'Task',
      entityId: task.id,
    });

    if (dto.assignedToId) {
      await this.notificationsService.create({
        userId: dto.assignedToId,
        title: 'Yeni Görev Atandı',
        message: `"${task.title}" görevi size atandı.`,
        type: NotificationType.TASK_ASSIGNED,
        metadata: { taskId: task.id },
      });
    }

    return task;
  }

  async findAll(
    actor: JwtPayload,
    filters?: {
      status?: TaskStatus;
      assignedToId?: string;
      priority?: string;
      departmentId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const where = await this.buildAccessFilter(actor, filters);
    const titleFilter = filters?.search?.trim();
    if (titleFilter) {
      (where as any).title = { contains: titleFilter, mode: 'insensitive' };
    }

    const isPaginated = !!filters?.page;
    const take = filters?.limit ?? 100;
    const skip = filters?.page ? (filters.page - 1) * take : undefined;

    const queryOpts: any = {
      where,
      include: this.taskIncludes(),
      orderBy: [{ priority: 'desc' as const }, { dueDate: 'asc' as const }],
    };
    if (isPaginated) { queryOpts.take = take; queryOpts.skip = skip; }

    const data = await this.prisma.task.findMany(queryOpts);

    if (isPaginated) {
      const total = await this.prisma.task.count({ where });
      return { data, total, page: filters.page!, limit: take };
    }

    return data;
  }

  async findOne(id: string, actor: JwtPayload) {
    await this.assertAccess(id, actor);
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...this.taskIncludes(),
        comments: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
        history: { orderBy: { createdAt: 'desc' }, take: 20 },
        subTasks: { where: { deletedAt: null } },
        attachments: { include: { file: true } },
      },
    });

    if (!task) throw new NotFoundException('Görev bulunamadı');
    return task;
  }

  async update(id: string, dto: UpdateTaskDto, actor: JwtPayload) {
    await this.assertAccess(id, actor, true);
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Görev bulunamadı');

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: this.taskIncludes(),
    });

    if (dto.status && dto.status !== existing.status) {
      await this.prisma.taskHistory.create({
        data: {
          taskId: id,
          userId: actor.sub,
          oldStatus: existing.status,
          newStatus: dto.status,
        },
      });
    }

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.TASK_UPDATE,
      entityType: 'Task',
      entityId: id,
      metadata: dto as Prisma.InputJsonValue,
    });

    return task;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: JwtPayload) {
    const task = await this.findOne(id, actor);
    const isEmployee = actor.role === UserRole.EMPLOYEE;

    if (isEmployee && task.assignedToId !== actor.sub) {
      throw new ForbiddenException('Bu görevi güncelleme yetkiniz yok');
    }

    // Employee completing task goes to WAITING_REVIEW if manager approval needed
    let newStatus = dto.status;
    if (isEmployee && dto.status === TaskStatus.COMPLETED) {
      newStatus = TaskStatus.WAITING_REVIEW;
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status: newStatus },
      include: this.taskIncludes(),
    });

    await this.prisma.taskHistory.create({
      data: {
        taskId: id,
        userId: actor.sub,
        oldStatus: task.status,
        newStatus,
        note: dto.note,
      },
    });

    if (newStatus === TaskStatus.WAITING_REVIEW && task.createdById) {
      await this.notificationsService.create({
        userId: task.createdById,
        title: 'Görev İnceleme Bekliyor',
        message: `"${task.title}" görevi inceleme için gönderildi.`,
        type: NotificationType.TASK_ASSIGNED,
        metadata: { taskId: id },
      });
    }

    if (newStatus === TaskStatus.COMPLETED && task.assignedToId && !isEmployee) {
      await this.notificationsService.create({
        userId: task.assignedToId,
        title: 'Görev Onaylandı',
        message: `"${task.title}" göreviniz onaylandı ve tamamlandı.`,
        type: NotificationType.TASK_APPROVED,
        metadata: { taskId: id },
      });
    }

    if (newStatus === TaskStatus.IN_PROGRESS && task.assignedToId && !isEmployee && dto.note) {
      await this.notificationsService.create({
        userId: task.assignedToId,
        title: 'Revize İstendi',
        message: `"${task.title}" görevi için revize istendi: ${dto.note}`,
        type: NotificationType.TASK_REVISION,
        metadata: { taskId: id },
      });
    }

    return updated;
  }

  async addComment(id: string, dto: CreateCommentDto, actor: JwtPayload) {
    await this.assertAccess(id, actor);
    const comment = await this.prisma.taskComment.create({
      data: { taskId: id, userId: actor.sub, comment: dto.comment },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    const task = await this.prisma.task.findUnique({
      where: { id },
      select: { title: true, assignedToId: true, createdById: true },
    });
    const notifyIds = new Set(
      [task?.assignedToId, task?.createdById].filter(
        (uid): uid is string => !!uid && uid !== actor.sub,
      ),
    );
    for (const userId of notifyIds) {
      await this.notificationsService.create({
        userId,
        title: 'Yeni Yorum',
        message: `"${task?.title}" görevine yorum eklendi.`,
        type: NotificationType.GENERAL,
        metadata: { taskId: id, commentId: comment.id },
      });
    }

    return comment;
  }

  async softDelete(id: string, actor: JwtPayload) {
    await this.assertAccess(id, actor, true);
    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date(), status: TaskStatus.CANCELLED },
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.TASK_DELETE,
      entityType: 'Task',
      entityId: id,
    });

    return { message: 'Görev iptal edildi' };
  }

  private taskIncludes() {
    return {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      department: { select: { id: true, name: true } },
    };
  }

  private async buildAccessFilter(
    actor: JwtPayload,
    filters?: {
      status?: TaskStatus;
      assignedToId?: string;
      priority?: string;
      departmentId?: string;
    },
  ): Promise<Prisma.TaskWhereInput> {
    const where: Prisma.TaskWhereInput = { deletedAt: null };
    if (filters?.status) where.status = filters.status;
    if (filters?.assignedToId) where.assignedToId = filters.assignedToId;
    if (filters?.priority) where.priority = filters.priority as Prisma.EnumTaskPriorityFilter;
    if (filters?.departmentId) where.departmentId = filters.departmentId;

    if (actor.role === UserRole.SUPER_ADMIN) return where;

    if (actor.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: { id: actor.sub },
        include: { managedTeams: { include: { members: true } } },
      });
      const teamMemberIds = manager?.managedTeams.flatMap((t) =>
        t.members.map((m) => m.userId),
      ) ?? [];

      where.OR = [
        { createdById: actor.sub },
        { assignedToId: actor.sub },
        ...(teamMemberIds.length ? [{ assignedToId: { in: teamMemberIds } }] : []),
        ...(manager?.departmentId ? [{ departmentId: manager.departmentId }] : []),
      ];
      return where;
    }

    where.assignedToId = actor.sub;
    return where;
  }

  private async assertAccess(taskId: string, actor: JwtPayload, requireManager = false) {
    if (actor.role === UserRole.SUPER_ADMIN) return;

    const task = await this.prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new NotFoundException('Görev bulunamadı');

    if (requireManager && actor.role === UserRole.MANAGER) {
      if (task.createdById === actor.sub) return;
    }

    if (actor.role === UserRole.EMPLOYEE && task.assignedToId === actor.sub) return;

    if (actor.role === UserRole.MANAGER) {
      const filter = await this.buildAccessFilter(actor);
      const accessible = await this.prisma.task.findFirst({
        where: { ...filter, id: taskId },
      });
      if (accessible) return;
    }

    throw new ForbiddenException('Bu göreve erişim yetkiniz yok');
  }
}
