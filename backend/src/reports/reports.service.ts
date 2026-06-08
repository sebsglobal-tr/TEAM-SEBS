import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ReportStatus,
  ReportType,
  UserRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateReportDto } from './dto/create-report.dto';

const ALLOWED_FILE_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.png', '.jpg', '.jpeg', '.zip',
];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ─── CRUD ───────────────────────────────────────────────────────────

  async create(dto: CreateReportDto, actor: JwtPayload) {
    // Employee creates a report; managerId is taken from their manager
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { managerId: true },
    });

    const report = await this.prisma.report.create({
      data: {
        userId: actor.sub,
        managerId: user?.managerId ?? actor.sub, // fallback to self if no manager
        title: dto.title,
        description: dto.description,
        reportType: dto.reportType ?? ReportType.DAILY,
        status: ReportStatus.PENDING,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return report;
  }

  async findAll(actor: JwtPayload, filters?: {
    status?: ReportStatus;
    reportType?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where = await this.buildAccessFilter(actor);
    if (filters?.status) where.status = filters.status;
    if (filters?.reportType) where.reportType = filters.reportType as ReportType;

    if (filters?.search) {
      where.OR = [
        ...(Array.isArray(where.OR) ? where.OR : []),
        { title: { contains: filters.search, mode: 'insensitive' as const } },
        { description: { contains: filters.search, mode: 'insensitive' as const } },
      ];
    }

    const isPaginated = !!filters?.page;
    const take = filters?.limit ?? 50;
    const skip = filters?.page ? (filters.page - 1) * take : undefined;

    const queryOpts: Prisma.ReportFindManyArgs = {
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        files: true,
        feedbacks: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { files: true, feedbacks: true } },
      },
      orderBy: { createdAt: 'desc' },
    };

    if (isPaginated) {
      queryOpts.take = take;
      queryOpts.skip = skip;
    }

    const data = await this.prisma.report.findMany(queryOpts);

    if (isPaginated) {
      const total = await this.prisma.report.count({ where });
      return { data, total, page: filters!.page, limit: take };
    }

    return data;
  }

  async findOne(id: string, actor: JwtPayload) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        files: true,
        feedbacks: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!report) throw new NotFoundException('Rapor bulunamadı');
    await this.assertAccess(report, actor);

    return report;
  }

  async updateStatus(id: string, status: ReportStatus, actor: JwtPayload) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');

    // Manager can only update their own employees' reports
    if (actor.role === UserRole.MANAGER && report.managerId !== actor.sub) {
      throw new ForbiddenException('Bu raporu güncelleme yetkiniz yok');
    }

    return this.prisma.report.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        files: true,
      },
    });
  }

  // ─── Dosya Yükleme ──────────────────────────────────────────────────

  async uploadFile(reportId: string, file: Express.Multer.File, actor: JwtPayload) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    await this.assertAccess(report, actor);

    this.validateFile(file);

    // Only the report owner (employee) or admin can upload files
    if (actor.role === UserRole.EMPLOYEE && report.userId !== actor.sub) {
      throw new ForbiddenException('Bu rapora dosya yükleme yetkiniz yok');
    }

    // For now, store file info in DB (actual file storage via existing files module is separate)
    const reportFile = await this.prisma.reportFile.create({
      data: {
        reportId,
        fileName: this.sanitizeFilename(file.originalname),
        fileUrl: `/api/reports/${reportId}/files/`, // placeholder
        fileType: file.mimetype,
        fileSize: file.size,
      },
    });

    return reportFile;
  }

  async getFiles(reportId: string, actor: JwtPayload) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    await this.assertAccess(report, actor);

    return this.prisma.reportFile.findMany({
      where: { reportId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async downloadFile(reportId: string, fileId: string, actor: JwtPayload) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    await this.assertAccess(report, actor);

    const reportFile = await this.prisma.reportFile.findFirst({
      where: { id: fileId, reportId },
    });
    if (!reportFile) throw new NotFoundException('Dosya bulunamadı');

    return reportFile;
  }

  // ─── Geri Bildirim ──────────────────────────────────────────────────

  async addFeedback(reportId: string, message: string, actor: JwtPayload) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    await this.assertAccess(report, actor);

    // Manager or admin can leave feedback
    if (actor.role === UserRole.EMPLOYEE && report.userId !== actor.sub) {
      throw new ForbiddenException('Bu rapora yorum yapma yetkiniz yok');
    }

    const feedback = await this.prisma.feedback.create({
      data: {
        reportId,
        managerId: actor.role === UserRole.EMPLOYEE ? report.managerId : actor.sub,
        employeeId: report.userId,
        message,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return feedback;
  }

  async getFeedbacks(reportId: string, actor: JwtPayload) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    await this.assertAccess(report, actor);

    return this.prisma.feedback.findMany({
      where: { reportId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── İstatistik ─────────────────────────────────────────────────────

  async getMyStats(userId: string) {
    const [
      totalReports,
      pendingReports,
      approvedReports,
      recentReports,
    ] = await Promise.all([
      this.prisma.report.count({ where: { userId } }),
      this.prisma.report.count({ where: { userId, status: ReportStatus.PENDING } }),
      this.prisma.report.count({ where: { userId, status: ReportStatus.APPROVED } }),
      this.prisma.report.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          files: true,
          feedbacks: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              employee: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    return { totalReports, pendingReports, approvedReports, recentReports };
  }

  // ─── Yardımcı Metotlar ──────────────────────────────────────────────

  private async buildAccessFilter(actor: JwtPayload) {
    const where: Prisma.ReportWhereInput = {};

    if (actor.role === UserRole.SUPER_ADMIN) return where;

    if (actor.role === UserRole.MANAGER) {
      // Manager can see reports where they are the managerId
      // or reports from employees assigned to them
      return {
        OR: [
          { managerId: actor.sub },
          { userId: actor.sub },
        ],
      };
    }

    // Employee: only their own reports
    return { userId: actor.sub };
  }

  private async assertAccess(
    report: { userId: string; managerId: string },
    actor: JwtPayload,
  ) {
    if (actor.role === UserRole.SUPER_ADMIN) return;
    if (report.userId === actor.sub || report.managerId === actor.sub) return;

    throw new ForbiddenException('Bu rapora erişim yetkiniz yok');
  }

  private validateFile(file: Express.Multer.File) {
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Dosya boyutu 25MB limitini aşıyor');
    }

    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      throw new BadRequestException('Bu dosya türüne izin verilmiyor. İzin verilenler: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, ZIP');
    }
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
  }
}
