import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole, ReportStatus } from '@prisma/client';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { AddFeedbackDto } from './dto/add-feedback.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('reports')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  // ─── Rapor CRUD ─────────────────────────────────────────────────────

  @Post()
  create(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.create(dto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: ReportStatus,
    @Query('reportType') reportType?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.findAll(user, {
      status,
      reportType,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.reportsService.findOne(id, user);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.updateStatus(id, dto.status, user);
  }

  // ─── Dosya Yükleme ──────────────────────────────────────────────────

  @Post(':id/files')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.uploadFile(id, file, user);
  }

  @Get(':id/files')
  getFiles(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.reportsService.getFiles(id, user);
  }

  @Get(':id/files/:fileId/download')
  downloadFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.downloadFile(id, fileId, user);
  }

  // ─── Geri Bildirim ──────────────────────────────────────────────────

  @Post(':id/feedbacks')
  addFeedback(
    @Param('id') id: string,
    @Body() dto: AddFeedbackDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.addFeedback(id, dto.message, user);
  }

  @Get(':id/feedbacks')
  getFeedbacks(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.reportsService.getFeedbacks(id, user);
  }

  // ─── Dashboard Özet ─────────────────────────────────────────────────

  // ─── İstatistik ─────────────────────────────────────────────────────

  @Get('stats/my')
  getMyStats(@CurrentUser() user: JwtPayload) {
    return this.reportsService.getMyStats(user.sub);
  }
}
