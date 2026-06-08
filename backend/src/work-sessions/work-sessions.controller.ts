import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EmployeeStatus, UserRole } from '@prisma/client';
import { WorkSessionsService } from './work-sessions.service';
import { WebHeartbeatDto } from './dto/heartbeat.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('work-sessions')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class WorkSessionsController {
  constructor(private workSessionsService: WorkSessionsService) {}

  @Post('start')
  start(@CurrentUser() user: JwtPayload) {
    return this.workSessionsService.start(user.sub);
  }

  @Post('stop')
  stop(@CurrentUser() user: JwtPayload) {
    return this.workSessionsService.stop(user.sub);
  }

  @Post('break/start')
  startBreak(@CurrentUser() user: JwtPayload) {
    return this.workSessionsService.startBreak(user.sub);
  }

  @Post('break/end')
  endBreak(@CurrentUser() user: JwtPayload) {
    return this.workSessionsService.endBreak(user.sub);
  }

  @Post('heartbeat')
  heartbeat(@CurrentUser() user: JwtPayload, @Body() dto: WebHeartbeatDto) {
    return this.workSessionsService.sendHeartbeat(
      user.sub,
      dto.status ?? EmployeeStatus.ONLINE_ACTIVE,
    );
  }

  @Get('today')
  getToday(@CurrentUser() user: JwtPayload) {
    return this.workSessionsService.getToday(user.sub);
  }

  @Get('dashboard-stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  getDashboardStats(@CurrentUser() user: JwtPayload) {
    return this.workSessionsService.getDashboardStats(user);
  }

  @Get('team/today')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  getTeamToday(@CurrentUser() user: JwtPayload) {
    return this.workSessionsService.getTeamToday(user);
  }

  @Get('user/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  getByUser(
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.workSessionsService.getByUser(
      userId,
      user,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('reports')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  getReports(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.workSessionsService.getReports({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      userId,
      departmentId,
    });
  }

  @Get(':id/timeline')
  getTimeline(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workSessionsService.getSessionTimeline(id, user);
  }
}
