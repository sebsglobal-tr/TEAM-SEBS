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
import { CreateTaskDto, UpdateTaskDto, UpdateStatusDto } from './dto/create-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  // ─── CRUD ───────────────────────────────────────────────────────────────

  async create(dto: CreateTaskDto, actor: JwtPayload) {
    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        assignedToId: dto.assignedToId,
        departmentId: dto.departmentId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        estimatedMinutes: dto.estimatedMinutes,
        parentTaskId: dto.parentTaskId,
        createdById: actor.sub,
      },
      include: this.taskIncludes(),
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.TASK_CREATE,
      entityType: 'Task',
      entityId: task.id,
      metadata: { title: task.title, assignedToId: dto.assignedToId ?? null },
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
      include: {
        ...this.taskIncludes(),
        subTasks: {
          where: { deletedAt: null },
          select: { id: true, title: true, status: true, assignedToId: true },
        },
        _count: { select: { subTasks: true } },
      },
      orderBy: [
        { priority: 'desc' as const },
        { dueDate: 'asc' as const },
        { createdAt: 'desc' as const },
      ],
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
        subTasks: {
          where: { deletedAt: null },
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
          },
        },
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

    const updateData: any = { ...dto };
    if (dto.dueDate) updateData.dueDate = new Date(dto.dueDate);
    if (dto.status !== undefined) delete updateData.status; // use updateStatus instead

    const task = await this.prisma.task.update({
      where: { id },
      data: updateData,
      include: this.taskIncludes(),
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.TASK_UPDATE,
      entityType: 'Task',
      entityId: id,
      metadata: dto as any,
    });

    return task;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: JwtPayload) {
    const task = await this.findOne(id, actor);

    // Employee can only update their own tasks
    if (actor.role === UserRole.EMPLOYEE && task.assignedToId !== actor.sub) {
      throw new ForbiddenException('Bu görevi güncelleme yetkiniz yok');
    }

    // Employee completing → WAITING_REVIEW (needs manager approval)
    let newStatus = dto.status;
    if (actor.role === UserRole.EMPLOYEE && dto.status === TaskStatus.COMPLETED) {
      newStatus = TaskStatus.WAITING_REVIEW;
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        status: newStatus,
        ...(newStatus === TaskStatus.COMPLETED ? { completionPercent: 100 } : {}),
      },
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

    // Notifications
    if (newStatus === TaskStatus.WAITING_REVIEW && task.createdById) {
      await this.notificationsService.create({
        userId: task.createdById,
        title: 'Görev İnceleme Bekliyor',
        message: `"${task.title}" inceleme için gönderildi.`,
        type: NotificationType.TASK_ASSIGNED,
        metadata: { taskId: id },
      });
    }

    if (newStatus === TaskStatus.COMPLETED && task.assignedToId && actor.role !== UserRole.EMPLOYEE) {
      await this.notificationsService.create({
        userId: task.assignedToId,
        title: 'Görev Onaylandı',
        message: `"${task.title}" onaylandı.`,
        type: NotificationType.TASK_APPROVED,
        metadata: { taskId: id },
      });
    }

    if (newStatus === TaskStatus.IN_PROGRESS && task.assignedToId && dto.note) {
      await this.notificationsService.create({
        userId: task.assignedToId,
        title: 'Revize İstendi',
        message: `"${task.title}" revize istendi: ${dto.note}`,
        type: NotificationType.TASK_REVISION,
        metadata: { taskId: id },
      });
    }

    return updated;
  }

  // ─── Assignment Flow ─────────────────────────────────────────────────────

  // Admin assigns a task to a manager
  async assignToManager(taskId: string, managerId: string, actor: JwtPayload) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new NotFoundException('Görev bulunamadı');

    const manager = await this.prisma.user.findUnique({ where: { id: managerId } });
    if (!manager || manager.role !== UserRole.MANAGER) {
      throw new NotFoundException('Geçerli bir yönetici bulunamadı');
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { assignedToId: managerId, status: TaskStatus.IN_PROGRESS },
      include: this.taskIncludes(),
    });

    await this.notificationsService.create({
      userId: managerId,
      title: 'Size Görev Atandı',
      message: `Admin size "${task.title}" görevini atadı.`,
      type: NotificationType.TASK_ASSIGNED,
      metadata: { taskId },
    });

    return updated;
  }

  // Manager assigns a task (or subtask) to an employee
  async assignToEmployee(taskId: string, employeeId: string, actor: JwtPayload) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new NotFoundException('Görev bulunamadı');

    // Manager can only assign tasks they own or are assigned to them
    if (actor.role === UserRole.MANAGER && task.createdById !== actor.sub && task.assignedToId !== actor.sub) {
      throw new ForbiddenException('Bu görevi yalnızca kendi görevlerinizde yapabilirsiniz');
    }

    const employee = await this.prisma.user.findUnique({ where: { id: employeeId } });
    if (!employee || employee.role !== UserRole.EMPLOYEE) {
      throw new NotFoundException('Geçerli bir çalışan bulunamadı');
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { assignedToId: employeeId, status: TaskStatus.IN_PROGRESS },
      include: this.taskIncludes(),
    });

    await this.notificationsService.create({
      userId: employeeId,
      title: 'Size Görev Atandı',
      message: `"${task.title}" görevi size atandı.`,
      type: NotificationType.TASK_ASSIGNED,
      metadata: { taskId },
    });

    return updated;
  }

  // Manager splits a task into subtasks for different employees
  async splitTask(
    taskId: string,
    subtasks: Array<{ title: string; assignedToId?: string }>,
    actor: JwtPayload,
  ) {
    const parentTask = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
    });
    if (!parentTask) throw new NotFoundException('Görev bulunamadı');

    if (actor.role === UserRole.MANAGER && parentTask.createdById !== actor.sub && parentTask.assignedToId !== actor.sub) {
      throw new ForbiddenException('Bu görevi yalnızca kendi görevlerinizde yapabilirsiniz');
    }

    // Mark parent as IN_PROGRESS
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.IN_PROGRESS },
    });

    // Create subtasks
    const createdSubtasks = [];
    for (const st of subtasks) {
      const subtask = await this.prisma.task.create({
        data: {
          title: st.title,
          description: `"${parentTask.title}" görevinin alt görevi`,
          parentTaskId: taskId,
          assignedToId: st.assignedToId,
          createdById: actor.sub,
          departmentId: parentTask.departmentId,
          priority: parentTask.priority,
          status: TaskStatus.TODO,
        },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
      createdSubtasks.push(subtask);

      if (st.assignedToId) {
        await this.notificationsService.create({
          userId: st.assignedToId,
          title: 'Alt Görev Atandı',
          message: `"${st.title}" alt görevi size atandı.`,
          type: NotificationType.TASK_ASSIGNED,
          metadata: { taskId: subtask.id, parentTaskId: taskId },
        });
      }
    }

    return { parentTask: { id: taskId, title: parentTask.title }, subtasks: createdSubtasks };
  }

  // ─── Comment ─────────────────────────────────────────────────────────────

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

  // ─── Delete ──────────────────────────────────────────────────────────────

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

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private taskIncludes() {
    return {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
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
    if (filters?.priority) where.priority = filters.priority as any;
    if (filters?.departmentId) where.departmentId = filters.departmentId;

    // SUPER_ADMIN: sees everything
    if (actor.role === UserRole.SUPER_ADMIN) {
      // For admin with a specific user filter, respect it
      return where;
    }

    // MANAGER: assigned to them, created by them, assigned to their employees, pool (unassigned)
    if (actor.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: { id: actor.sub },
        include: { managedTeams: { include: { members: true } } },
      });

      const teamMemberIds = manager?.managedTeams.flatMap((t) =>
        t.members.map((m) => m.userId),
      ) ?? [];

      // Tasks assigned to their employees OR assigned to them OR created by them OR unassigned
      where.OR = [
        { assignedToId: actor.sub },
        { createdById: actor.sub },
        ...(teamMemberIds.length ? [{ assignedToId: { in: teamMemberIds } }] : []),
      ];

      return where;
    }

    // EMPLOYEE: only their own tasks
    where.assignedToId = actor.sub;
    return where;
  }

  private async assertAccess(taskId: string, actor: JwtPayload, requireManager = false) {
    if (actor.role === UserRole.SUPER_ADMIN) return;

    const task = await this.prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new NotFoundException('Görev bulunamadı');

    if (requireManager && actor.role === UserRole.MANAGER) {
      // Manager can update tasks they created or that are assigned to them
      if (task.createdById === actor.sub || task.assignedToId === actor.sub) return;
      throw new ForbiddenException('Bu görevi düzenleme yetkiniz yok');
    }

    // Employee: only their assigned tasks
    if (actor.role === UserRole.EMPLOYEE && task.assignedToId === actor.sub) return;

    // Manager: check via access filter
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
