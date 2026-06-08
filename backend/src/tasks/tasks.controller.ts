import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole, TaskStatus, TaskType, TaskPriority } from '@prisma/client';
import { TasksService } from './tasks.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateStatusDto,
  AssignTaskDto,
  SplitTaskDto,
  CreateBulkTaskDto,
  CreateCommentDto,
} from './dto/create-task.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('tasks')
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
export class TasksController {
  constructor(private tasksService: TasksService) {}

  // ─── CRUD ──────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: JwtPayload) {
    return this.tasksService.create(dto, user);
  }

  @Post('bulk')
  @Roles(UserRole.SUPER_ADMIN)
  createBulk(@Body() tasks: CreateBulkTaskDto[], @CurrentUser() user: JwtPayload) {
    return this.tasksService.createBulk(tasks, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: TaskStatus,
    @Query('assignedToId') assignedToId?: string,
    @Query('priority') priority?: TaskPriority,
    @Query('taskType') taskType?: TaskType,
    @Query('responsibleManagerId') responsibleManagerId?: string,
    @Query('parentTaskId') parentTaskId?: string,
    @Query('pool') pool?: string,
    @Query('overdue') overdue?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tasksService.findAll(user, {
      status, assignedToId, priority, taskType, responsibleManagerId,
      parentTaskId, pool: pool === 'true', overdue: overdue === 'true',
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: JwtPayload) {
    return this.tasksService.getStats(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.update(id, dto, user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.updateStatus(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.softDelete(id, user);
  }

  // ─── Assignment Flow ──────────────────────────────────────────────

  @Patch(':id/assign')
  @Roles(UserRole.SUPER_ADMIN)
  assignToManager(@Param('id') id: string, @Body() dto: AssignTaskDto, @CurrentUser() user: JwtPayload) {
    return this.tasksService.assignToManager(id, dto.assigneeId, user);
  }

  @Patch(':id/assign-employee')
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  assignToEmployee(@Param('id') id: string, @Body() dto: AssignTaskDto, @CurrentUser() user: JwtPayload) {
    return this.tasksService.assignToEmployee(id, dto.assigneeId, user);
  }

  @Post(':id/split')
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  splitTask(@Param('id') id: string, @Body() dto: SplitTaskDto, @CurrentUser() user: JwtPayload) {
    return this.tasksService.splitTask(id, dto.subtasks, user);
  }

  // ─── Comments ─────────────────────────────────────────────────────

  @Post(':id/comments')
  addComment(@Param('id') id: string, @Body() dto: CreateCommentDto, @CurrentUser() user: JwtPayload) {
    return this.tasksService.addComment(id, dto, user);
  }

  // ─── Files ─────────────────────────────────────────────────────────

  @Post(':id/files')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  addFile(@Param('id') id: string, @Body() body: { fileName: string; fileUrl: string; fileType: string; fileSize: number }, @CurrentUser() user: JwtPayload) {
    return this.tasksService.addFile(id, body, user);
  }

  @Get(':id/files')
  getFiles(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.getFiles(id, user);
  }

  // ─── History Logs ─────────────────────────────────────────────────

  @Get(':id/history')
  getHistory(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.getHistory(id, user);
  }
}
