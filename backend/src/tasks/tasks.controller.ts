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
import { UserRole, TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, UpdateStatusDto, AssignTaskDto, SplitTaskDto } from './dto/create-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
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

  // ─── CRUD ───────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: JwtPayload) {
    return this.tasksService.create(dto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: TaskStatus,
    @Query('assignedToId') assignedToId?: string,
    @Query('priority') priority?: string,
    @Query('departmentId') departmentId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tasksService.findAll(user, {
      status, assignedToId, priority, departmentId, search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
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

  // ─── Comment ────────────────────────────────────────────────────────

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.addComment(id, dto, user);
  }

  // ─── Assignment Flow: Admin → Manager ──────────────────────────────

  @Patch(':id/assign')
  @Roles(UserRole.SUPER_ADMIN)
  assignToManager(
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.assignToManager(id, dto.assigneeId, user);
  }

  // ─── Assignment Flow: Manager → Employee ───────────────────────────

  @Patch(':id/assign-employee')
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  assignToEmployee(
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.assignToEmployee(id, dto.assigneeId, user);
  }

  // ─── Split Task: Manager splits into subtasks for employees ────────

  @Post(':id/split')
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  splitTask(
    @Param('id') id: string,
    @Body() dto: SplitTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.splitTask(id, dto.subtasks, user);
  }
}
