import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileType, FileVisibility, AuditAction, UserRole, NotificationType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.ps1', '.sh', '.scr', '.vbs'];
const ALLOWED_MIME_PREFIXES = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip',
];

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private storage: LocalStorageProvider,
    private configService: ConfigService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  async upload(
    file: Express.Multer.File,
    actor: JwtPayload,
    options?: {
      fileType?: FileType;
      taskId?: string;
      employeeId?: string;
      description?: string;
      visibility?: FileVisibility;
    },
  ) {
    this.validateFile(file);

    const folder = options?.taskId ? `tasks/${options.taskId}` : `users/${actor.sub}`;
    const { storedName, path } = await this.storage.upload(file, folder);

    const record = await this.prisma.file.create({
      data: {
        originalName: this.sanitizeFilename(file.originalname),
        storedName,
        mimeType: file.mimetype,
        size: file.size,
        path,
        fileType: options?.fileType ?? FileType.TASK_ATTACHMENT,
        uploadedById: actor.sub,
        taskId: options?.taskId,
        employeeId: options?.employeeId ?? actor.sub,
        description: options?.description,
        visibility: options?.visibility ?? FileVisibility.PRIVATE,
      },
    });

    if (options?.taskId) {
      await this.prisma.taskAttachment.create({
        data: { taskId: options.taskId, fileId: record.id },
      });
    }

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.FILE_UPLOAD,
      entityType: 'File',
      entityId: record.id,
      metadata: { originalName: record.originalName, size: record.size },
    });

    if (options?.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: options.taskId },
        select: { title: true, assignedToId: true, createdById: true },
      });
      const notifyIds = new Set(
        [task?.assignedToId, task?.createdById].filter(
          (id): id is string => !!id && id !== actor.sub,
        ),
      );
      for (const userId of notifyIds) {
        await this.notificationsService.create({
          userId,
          title: 'Dosya Yüklendi',
          message: `"${task?.title}" görevine yeni dosya eklendi: ${record.originalName}`,
          type: NotificationType.FILE_UPLOADED,
          metadata: { taskId: options.taskId, fileId: record.id },
        });
      }
    }

    return record;
  }

  async findAll(actor: JwtPayload, filters?: {
    taskId?: string;
    fileType?: FileType;
    search?: string;
    limit?: number;
    page?: number;
  }) {
    const where = await this.buildAccessFilter(actor);
    if (filters?.taskId) where.taskId = filters.taskId;
    if (filters?.fileType) where.fileType = filters.fileType;

    if (filters?.search) {
      const s = filters.search.trim();
      (where as any).originalName = { contains: s, mode: 'insensitive' };
    }

    const isPaginated = !!filters?.page;
    const take = filters?.limit ?? 50;
    const skip = filters?.page ? (filters.page - 1) * take : undefined;

    const queryOpts: any = {
      where,
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' as const },
    };
    if (isPaginated) { queryOpts.take = take; queryOpts.skip = skip; }

    const data = await this.prisma.file.findMany(queryOpts);

    if (isPaginated) {
      const total = await this.prisma.file.count({ where });
      return { data, total, page: filters.page!, limit: take };
    }

    return data;
  }

  async download(id: string, actor: JwtPayload) {
    const file = await this.prisma.file.findFirst({
      where: { id, deletedAt: null },
    });
    if (!file) throw new NotFoundException('Dosya bulunamadı');

    await this.assertAccess(file, actor);

    const buffer = await this.storage.download(file.path);

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.FILE_DOWNLOAD,
      entityType: 'File',
      entityId: id,
    });

    return { file, buffer };
  }

  async remove(id: string, actor: JwtPayload) {
    const file = await this.prisma.file.findFirst({ where: { id, deletedAt: null } });
    if (!file) throw new NotFoundException('Dosya bulunamadı');

    await this.assertAccess(file, actor);

    await this.prisma.file.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: AuditAction.FILE_DELETE,
      entityType: 'File',
      entityId: id,
    });

    return { message: 'Dosya silindi' };
  }

  private validateFile(file: Express.Multer.File) {
    const maxMb = parseInt(this.configService.get<string>('MAX_FILE_SIZE_MB', '25'), 10);
    const maxBytes = maxMb * 1024 * 1024;

    if (file.size > maxBytes) {
      throw new BadRequestException(`Dosya boyutu ${maxMb}MB limitini aşıyor`);
    }

    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException('Bu dosya türüne izin verilmiyor');
    }

    const mimeAllowed = ALLOWED_MIME_PREFIXES.some((p) => file.mimetype.startsWith(p));
    if (!mimeAllowed) {
      throw new BadRequestException('Bu MIME türüne izin verilmiyor');
    }
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
  }

  private async buildAccessFilter(actor: JwtPayload) {
    const where: Record<string, unknown> = { deletedAt: null };

    if (actor.role === UserRole.SUPER_ADMIN) return where;

    if (actor.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: { id: actor.sub },
        include: { managedTeams: { include: { members: true } } },
      });
      const teamMemberIds = manager?.managedTeams.flatMap((t) =>
        t.members.map((m) => m.userId),
      ) ?? [];

      return {
        deletedAt: null,
        OR: [
          { uploadedById: actor.sub },
          ...(teamMemberIds.length
            ? [{ uploadedById: { in: teamMemberIds } }, { employeeId: { in: teamMemberIds } }]
            : []),
        ],
      };
    }

    return {
      deletedAt: null,
      OR: [
        { uploadedById: actor.sub },
        { employeeId: actor.sub },
        { task: { assignedToId: actor.sub } },
      ],
    };
  }

  private async assertAccess(
    file: { uploadedById: string; employeeId: string | null; taskId: string | null },
    actor: JwtPayload,
  ) {
    if (actor.role === UserRole.SUPER_ADMIN) return;
    if (file.uploadedById === actor.sub || file.employeeId === actor.sub) return;

    if (file.taskId) {
      const task = await this.prisma.task.findUnique({ where: { id: file.taskId } });
      if (task?.assignedToId === actor.sub) return;
    }

    if (actor.role === UserRole.MANAGER) {
      const filter = await this.buildAccessFilter(actor);
      const accessible = await this.prisma.file.findFirst({
        where: { ...filter, id: (file as { id?: string }).id },
      });
      if (accessible) return;
    }

    throw new ForbiddenException('Bu dosyaya erişim yetkiniz yok');
  }
}
