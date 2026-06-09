import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  UserRole,
  TaskStatus,
  TaskType,
  TaskPriority,
  CommentType,
  AuditAction,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateStatusDto,
  CreateCommentDto,
} from './dto/create-task.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

// ─── Constants ──────────────────────────────────────────────────────────────

const MANAGER_STATUSES = [
  TaskStatus.ASSIGNED_TO_MANAGER,
  TaskStatus.IN_PROGRESS,
  TaskStatus.PARTIALLY_COMPLETED,
  TaskStatus.BLOCKED,
  TaskStatus.SUBMITTED,
  TaskStatus.MANAGER_APPROVED,
];

const EMPLOYEE_STATUSES = [
  TaskStatus.ASSIGNED_TO_EMPLOYEE,
  TaskStatus.PENDING,
  TaskStatus.IN_PROGRESS,
  TaskStatus.PARTIALLY_COMPLETED,
  TaskStatus.BLOCKED,
  TaskStatus.SUBMITTED,
  TaskStatus.REVISION_REQUESTED,
];

const STATUS_LABELS: Record<string, string> = {
  POOL: 'Havuzda',
  ASSIGNED_TO_MANAGER: 'Yöneticiye Atandı',
  ASSIGNED_TO_EMPLOYEE: 'Çalışana Atandı',
  PENDING: 'Beklemede',
  IN_PROGRESS: 'Devam Ediyor',
  PARTIALLY_COMPLETED: 'Kısmen Tamamlandı',
  BLOCKED: 'Blokaj Var',
  SUBMITTED: 'Tamamlandı Gönderildi',
  REVISION_REQUESTED: 'Revize İstendi',
  MANAGER_APPROVED: 'Yönetici Onayladı',
  ADMIN_APPROVED: 'Admin Onayladı',
  CANCELLED: 'İptal Edildi',
};

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  // ─── CREATE ───────────────────────────────────────────────────────────────

  async create(dto: CreateTaskDto, actor: JwtPayload) {
    const data: any = {
      title: dto.title,
      description: dto.description,
      expectedOutput: (dto as any).expectedOutput,
      taskType: dto.taskType ?? TaskType.OTHER,
      priority: dto.priority ?? TaskPriority.MEDIUM,
      status: dto.status ?? TaskStatus.POOL,
      createdById: actor.sub,
      parentTaskId: dto.parentTaskId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      estimatedMinutes: dto.estimatedMinutes,
      departmentId: dto.departmentId,
    };

    // If assignedToId provided, set appropriate status
    if (dto.assignedToId) {
      data.assignedToId = dto.assignedToId;
      // Determine role from assignee
      const assignee = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
      if (assignee) {
        data.assignedToRole = assignee.role;
        if (assignee.role === UserRole.MANAGER && !data.status) data.status = TaskStatus.ASSIGNED_TO_MANAGER;
        if (assignee.role === UserRole.EMPLOYEE && !data.status) data.status = TaskStatus.ASSIGNED_TO_EMPLOYEE;
      }
    }

    if (dto.responsibleManagerId) {
      data.responsibleManagerId = dto.responsibleManagerId;
    }

    const task = await this.prisma.task.create({
      data,
      include: this.taskIncludes(),
    });

    await this.logStatus(task.id, null, task.status, actor.sub, 'Görev oluşturuldu');

    // Notify if assigned
    if (dto.assignedToId && dto.assignedToId !== actor.sub) {
      await this.notificationsService.create({
        userId: dto.assignedToId,
        title: 'Yeni Görev',
        message: `"${task.title}" görevi size atandı.`,
        type: NotificationType.TASK_ASSIGNED,
        metadata: { taskId: task.id },
      });
    }

    return task;
  }

  async createBulk(tasks: CreateTaskDto[], actor: JwtPayload) {
    const created = [];
    for (const dto of tasks) {
      const task = await this.create(dto, actor);
      created.push(task);
    }
    return { count: created.length, tasks: created };
  }

  // ─── FIND ────────────────────────────────────────────────────────────────

  async findAll(
    actor: JwtPayload,
    filters?: {
      status?: TaskStatus;
      assignedToId?: string;
      priority?: TaskPriority;
      taskType?: TaskType;
      responsibleManagerId?: string;
      parentTaskId?: string;
      pool?: boolean;
      overdue?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const where = await this.buildAccessFilter(actor, filters);

    if (filters?.taskType) where.taskType = filters.taskType;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.responsibleManagerId) where.responsibleManagerId = filters.responsibleManagerId;
    if (filters?.parentTaskId !== undefined) where.parentTaskId = filters.parentTaskId;

    if (filters?.search) {
      (where as any).title = { contains: filters.search, mode: 'insensitive' };
    }

    // Overdue: dueDate < now AND status not completed/cancelled
    if (filters?.overdue) {
      (where as any).dueDate = { lt: new Date() };
      (where as any).status = { notIn: [TaskStatus.MANAGER_APPROVED, TaskStatus.ADMIN_APPROVED, TaskStatus.CANCELLED] };
    }

    const isPaginated = !!filters?.page;
    const take = filters?.limit ?? 100;
    const skip = filters?.page ? (filters.page - 1) * take : undefined;

    const queryOpts: any = {
      where,
      include: this.taskIncludes(),
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
        parentTask: {
          select: { id: true, title: true, status: true },
        },
        subTasks: {
          where: { deletedAt: null },
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        comments: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
        files: {
          include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        taskHistory: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!task) throw new NotFoundException('Görev bulunamadı');

    // Calculate overdue status
    const now = new Date();
    const isOverdue = !!task.dueDate && task.dueDate < now &&
      ![TaskStatus.MANAGER_APPROVED, TaskStatus.ADMIN_APPROVED, TaskStatus.CANCELLED].includes(task.status as any);

    return { ...task, isOverdue, statusLabel: STATUS_LABELS[task.status] ?? task.status };
  }

  async getStats(actor: JwtPayload) {
    const where = await this.buildAccessFilter(actor, {});

    const [total, pool, assignedToManager, assignedToEmployee, overdue, blocked, submitted, done] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.count({ where: { ...where, status: TaskStatus.POOL } }),
      this.prisma.task.count({ where: { ...where, status: TaskStatus.ASSIGNED_TO_MANAGER } }),
      this.prisma.task.count({ where: { ...where, status: TaskStatus.ASSIGNED_TO_EMPLOYEE } }),
      this.prisma.task.count({
        where: {
          ...where,
          dueDate: { lt: new Date() },
          status: { notIn: [TaskStatus.MANAGER_APPROVED, TaskStatus.ADMIN_APPROVED, TaskStatus.CANCELLED] },
        },
      }),
      this.prisma.task.count({ where: { ...where, status: TaskStatus.BLOCKED } }),
      this.prisma.task.count({ where: { ...where, status: TaskStatus.SUBMITTED } }),
      this.prisma.task.count({ where: { ...where, status: TaskStatus.MANAGER_APPROVED } }),
    ]);

    return {
      total, pool, assignedToManager, assignedToEmployee,
      overdue, blocked, submitted, done,
    };
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateTaskDto, actor: JwtPayload) {
    await this.assertAccess(id, actor, true);
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Görev bulunamadı');

    const updateData: any = { ...dto };
    if (dto.dueDate) updateData.dueDate = new Date(dto.dueDate);
    delete updateData.status; // use updateStatus instead

    const task = await this.prisma.task.update({
      where: { id },
      data: updateData,
      include: this.taskIncludes(),
    });

    return task;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: JwtPayload) {
    const task = await this.findOne(id, actor);

    // Permission check for status changes
    this.assertStatusChange(task, dto.status, actor);

    const updateData: any = { status: dto.status };

    // Set timestamps on completion/approval
    if (dto.status === TaskStatus.MANAGER_APPROVED) {
      updateData.approvedByManagerAt = new Date();
      updateData.completionPercent = 100;
      if (!task.completedAt) updateData.completedAt = new Date();
    }
    if (dto.status === TaskStatus.ADMIN_APPROVED) {
      updateData.approvedByAdminAt = new Date();
      updateData.completionPercent = 100;
      if (!task.completedAt) updateData.completedAt = new Date();
    }
    if (dto.status === TaskStatus.SUBMITTED && !task.completedAt) {
      updateData.completionPercent = Math.max(task.completionPercent, 80);
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: updateData,
      include: this.taskIncludes(),
    });

    // Log status change
    await this.logStatus(id, task.status, dto.status, actor.sub, dto.note);

    // Notifications
    await this.sendStatusNotifications(task, dto.status, actor.sub);

    // If all subtasks are MANAGER_APPROVED, check parent
    if (task.parentTaskId) {
      await this.checkParentCompletion(task.parentTaskId);
    }

    return updated;
  }

  // ─── ASSIGNMENT FLOW ────────────────────────────────────────────────────

  async assignToManager(taskId: string, managerId: string, actor: JwtPayload) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new NotFoundException('Görev bulunamadı');

    const manager = await this.prisma.user.findUnique({ where: { id: managerId } });
    if (!manager || manager.role !== UserRole.MANAGER) {
      throw new BadRequestException('Geçerli bir yönetici seçin');
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        assignedToId: managerId,
        assignedToRole: UserRole.MANAGER,
        responsibleManagerId: managerId,
        status: TaskStatus.ASSIGNED_TO_MANAGER,
      },
      include: this.taskIncludes(),
    });

    await this.logStatus(taskId, task.status, TaskStatus.ASSIGNED_TO_MANAGER, actor.sub, `${manager.firstName} ${manager.lastName}'a atandı`);

    await this.notificationsService.create({
      userId: managerId,
      title: 'Size Görev Atandı',
      message: `Admin "${task.title}" görevini size atadı.`,
      type: NotificationType.TASK_ASSIGNED,
      metadata: { taskId },
    });

    return updated;
  }

  async assignToEmployee(taskId: string, employeeId: string, actor: JwtPayload) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new NotFoundException('Görev bulunamadı');

    // Manager can only assign to their own employees
    if (actor.role === UserRole.MANAGER) {
      const employee = await this.prisma.user.findUnique({
        where: { id: employeeId },
        select: { id: true, managerId: true },
      });
      if (!employee || employee.managerId !== actor.sub) {
        throw new ForbiddenException('Bu çalışana görev atama yetkiniz yok');
      }
      // Task must belong to this manager
      if (task.responsibleManagerId !== actor.sub && task.createdById !== actor.sub && task.assignedToId !== actor.sub) {
        throw new ForbiddenException('Bu görevi yalnızca kendi görevlerinizde yapabilirsiniz');
      }
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        assignedToId: employeeId,
        assignedToRole: UserRole.EMPLOYEE,
        status: TaskStatus.ASSIGNED_TO_EMPLOYEE,
      },
      include: this.taskIncludes(),
    });

    await this.logStatus(taskId, task.status, TaskStatus.ASSIGNED_TO_EMPLOYEE, actor.sub, `Çalışana atandı`);

    await this.notificationsService.create({
      userId: employeeId,
      title: 'Size Görev Atandı',
      message: `"${task.title}" görevi size atandı.`,
      type: NotificationType.TASK_ASSIGNED,
      metadata: { taskId },
    });

    return updated;
  }

  async splitTask(
    taskId: string,
    subtasks: Array<{ title: string; assignedToId?: string }>,
    actor: JwtPayload,
  ) {
    const parentTask = await this.prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!parentTask) throw new NotFoundException('Görev bulunamadı');

    if (actor.role === UserRole.MANAGER &&
      parentTask.responsibleManagerId !== actor.sub &&
      parentTask.createdById !== actor.sub &&
      parentTask.assignedToId !== actor.sub) {
      throw new ForbiddenException('Bu görevi yalnızca kendi görevlerinizde bölebilirsiniz');
    }

    // Mark parent as in_progress
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.IN_PROGRESS },
    });

    const created = [];
    for (const st of subtasks) {
      const subtask = await this.prisma.task.create({
        data: {
          title: st.title,
          description: `"${parentTask.title}" görevinin alt görevi`,
          parentTaskId: taskId,
          assignedToId: st.assignedToId,
          assignedToRole: st.assignedToId ? UserRole.EMPLOYEE : null,
          createdById: actor.sub,
          responsibleManagerId: parentTask.responsibleManagerId ?? actor.sub,
          taskType: parentTask.taskType,
          priority: parentTask.priority,
          status: st.assignedToId ? TaskStatus.ASSIGNED_TO_EMPLOYEE : TaskStatus.PENDING,
        },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
      created.push(subtask);

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

    await this.logStatus(taskId, parentTask.status, TaskStatus.IN_PROGRESS, actor.sub, `${created.length} alt görev oluşturuldu`);

    return { parentTask: { id: taskId, title: parentTask.title }, subtasks: created };
  }

  // ─── COMMENTS ───────────────────────────────────────────────────────────

  async addComment(id: string, dto: CreateCommentDto, actor: JwtPayload) {
    await this.assertAccess(id, actor);
    const comment = await this.prisma.taskComment.create({
      data: {
        taskId: id,
        userId: actor.sub,
        message: dto.message,
        commentType: (dto.commentType as CommentType) ?? CommentType.NORMAL,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Notify other participants
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: { title: true, assignedToId: true, createdById: true, responsibleManagerId: true },
    });
    const notifyIds = new Set(
      [task?.assignedToId, task?.createdById, task?.responsibleManagerId].filter(
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

  // ─── FILES ──────────────────────────────────────────────────────────────

  async addFile(id: string, body: { fileName: string; fileUrl: string; fileType: string; fileSize: number }, actor: JwtPayload) {
    await this.assertAccess(id, actor);
    const file = await this.prisma.taskFile.create({
      data: {
        taskId: id,
        uploadedById: actor.sub,
        fileName: body.fileName,
        fileUrl: body.fileUrl,
        fileType: body.fileType,
        fileSize: body.fileSize,
      },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    return file;
  }

  async getFiles(id: string, actor: JwtPayload) {
    await this.assertAccess(id, actor);
    return this.prisma.taskFile.findMany({
      where: { taskId: id },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── HISTORY ────────────────────────────────────────────────────────────

  async getHistory(id: string, actor: JwtPayload) {
    await this.assertAccess(id, actor);
    return this.prisma.taskHistory.findMany({
      where: { taskId: id },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ─── DELETE ─────────────────────────────────────────────────────────────

  async softDelete(id: string, actor: JwtPayload) {
    await this.assertAccess(id, actor, true);
    const task = await this.prisma.task.findFirst({ where: { id, deletedAt: null } });
    if (!task) throw new NotFoundException('Görev bulunamadı');

    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date(), status: TaskStatus.CANCELLED },
    });

    await this.logStatus(id, task.status, TaskStatus.CANCELLED, actor.sub, 'Görev iptal edildi');

    return { message: 'Görev iptal edildi' };
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────

  private taskIncludes() {
    return {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      responsibleManager: { select: { id: true, firstName: true, lastName: true, email: true } },
      department: { select: { id: true, name: true } },
      _count: { select: { subTasks: true, files: true, comments: true } },
    };
  }

  private async buildAccessFilter(
    actor: JwtPayload,
    filters?: any,
  ): Promise<any> {
    const where: any = { deletedAt: null };

    if (filters?.status) where.status = filters.status;
    if (filters?.assignedToId) where.assignedToId = filters.assignedToId;

    // Pool filter — only unassigned tasks without a parent
    if (filters?.pool) {
      where.assignedToId = null;
      where.parentTaskId = null;
      where.status = { notIn: [TaskStatus.CANCELLED, TaskStatus.ADMIN_APPROVED] };
    }

    // SUPER_ADMIN sees everything
    if (actor.role === UserRole.SUPER_ADMIN) return where;

    // MANAGER: their tasks + their employee tasks
    if (actor.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: { id: actor.sub },
        select: { employees: { select: { id: true } } },
      });
      const employeeIds = manager?.employees.map((e) => e.id) ?? [];

      where.OR = [
        { assignedToId: actor.sub },
        { createdById: actor.sub },
        { responsibleManagerId: actor.sub },
        ...(employeeIds.length ? [{ assignedToId: { in: employeeIds } }] : []),
      ];
      return where;
    }

    // EMPLOYEE: only their tasks
    where.assignedToId = actor.sub;
    return where;
  }

  private async assertAccess(taskId: string, actor: JwtPayload, requireWrite = false) {
    if (actor.role === UserRole.SUPER_ADMIN) return;

    const task = await this.prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new NotFoundException('Görev bulunamadı');

    if (requireWrite && actor.role === UserRole.MANAGER) {
      if (task.createdById === actor.sub || task.assignedToId === actor.sub ||
          task.responsibleManagerId === actor.sub) return;
      throw new ForbiddenException('Bu görevi düzenleme yetkiniz yok');
    }

    if (actor.role === UserRole.EMPLOYEE && task.assignedToId === actor.sub) return;

    if (actor.role === UserRole.MANAGER) {
      const filter = await this.buildAccessFilter(actor, {});
      const accessible = await this.prisma.task.findFirst({ where: { ...filter, id: taskId } });
      if (accessible) return;
    }

    throw new ForbiddenException('Bu göreve erişim yetkiniz yok');
  }

  private assertStatusChange(task: any, newStatus: TaskStatus, actor: JwtPayload) {
    if (actor.role === UserRole.SUPER_ADMIN) return;

    if (actor.role === UserRole.EMPLOYEE) {
      if (task.assignedToId !== actor.sub) {
        throw new ForbiddenException('Bu görevin durumunu değiştiremezsiniz');
      }
      // Employee can only set certain statuses
      const allowed: TaskStatus[] = [TaskStatus.IN_PROGRESS, TaskStatus.PARTIALLY_COMPLETED, TaskStatus.BLOCKED, TaskStatus.SUBMITTED];
      if (!(allowed as any).includes(newStatus)) {
        throw new ForbiddenException('Bu durumu yalnızca yönetici veya admin değiştirebilir');
      }
    }

    if (actor.role === UserRole.MANAGER) {
      const allowed: TaskStatus[] = [
        TaskStatus.IN_PROGRESS, TaskStatus.PARTIALLY_COMPLETED, TaskStatus.BLOCKED,
        TaskStatus.SUBMITTED, TaskStatus.REVISION_REQUESTED, TaskStatus.MANAGER_APPROVED,
      ];
      if (!(allowed as any).includes(newStatus) && actor.role === UserRole.MANAGER) {
        throw new ForbiddenException('Bu durumu ayarlama yetkiniz yok');
      }
    }
  }

  private async sendStatusNotifications(task: any, newStatus: TaskStatus, changedBy: string) {
    const title = task.title;

    if (newStatus === TaskStatus.SUBMITTED && task.responsibleManagerId) {
      await this.notificationsService.create({
        userId: task.responsibleManagerId,
        title: 'Görev Tamamlandı Gönderildi',
        message: `"${title}" görevi inceleme için gönderildi.`,
        type: NotificationType.TASK_ASSIGNED,
        metadata: { taskId: task.id },
      });
    }

    if (newStatus === TaskStatus.REVISION_REQUESTED && task.assignedToId) {
      await this.notificationsService.create({
        userId: task.assignedToId,
        title: 'Revize İstendi',
        message: `"${title}" görevi için revize istendi.`,
        type: NotificationType.TASK_REVISION,
        metadata: { taskId: task.id },
      });
    }

    if (newStatus === TaskStatus.MANAGER_APPROVED && task.assignedToId) {
      await this.notificationsService.create({
        userId: task.assignedToId,
        title: 'Görev Onaylandı',
        message: `"${title}" görevi yönetici tarafından onaylandı.`,
        type: NotificationType.TASK_APPROVED,
        metadata: { taskId: task.id },
      });
    }

    if (newStatus === TaskStatus.BLOCKED && task.responsibleManagerId) {
      await this.notificationsService.create({
        userId: task.responsibleManagerId,
        title: 'Blokaj Bildirimi',
        message: `"${title}" görevi için blokaj bildirildi.`,
        type: NotificationType.TASK_REJECTED,
        metadata: { taskId: task.id },
      });
    }
  }

  private async checkParentCompletion(parentTaskId: string) {
    const subTasks = await this.prisma.task.findMany({
      where: { parentTaskId, deletedAt: null },
    });

    if (subTasks.length === 0) return;

    const allApproved = subTasks.every((st) =>
      st.status === TaskStatus.MANAGER_APPROVED || st.status === TaskStatus.ADMIN_APPROVED,
    );

    if (allApproved) {
      const total = subTasks.length;
      const done = subTasks.filter((st) =>
        st.status === TaskStatus.MANAGER_APPROVED || st.status === TaskStatus.ADMIN_APPROVED,
      ).length;
      const percent = Math.round((done / total) * 100);

      await this.prisma.task.update({
        where: { id: parentTaskId },
        data: { completionPercent: percent },
      });

      // If all done and no pending subtasks, auto-submit for admin approval
      if (percent === 100) {
        const parent = await this.prisma.task.findUnique({ where: { id: parentTaskId } });
        if (parent && parent.status !== TaskStatus.MANAGER_APPROVED && parent.status !== TaskStatus.ADMIN_APPROVED) {
          await this.prisma.task.update({
            where: { id: parentTaskId },
            data: { status: TaskStatus.MANAGER_APPROVED, approvedByManagerAt: new Date(), completedAt: new Date() },
          });
        }
      }
    }
  }

  private async logStatus(taskId: string, oldStatus: string | null, newStatus: string, changedById: string, note?: string) {
    await this.prisma.taskHistory.create({
      data: {
        taskId,
        userId: changedById,
        oldStatus: oldStatus as any ?? undefined,
        newStatus: newStatus as any,
        note: note ?? STATUS_LABELS[newStatus] ?? newStatus,
      },
    });
  }
}
