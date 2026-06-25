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

  /**
   * Oturumu duraklat (manuel — kullanıcı isteğiyle)
   */
  @Post('pause')
  pause(@CurrentUser() user: JwtPayload) {
    return this.workSessionsService.pause(user.sub, 'manual');
  }

  /**
   * Duraklatılmış oturumu devam ettir
   */
  @Post('resume')
  resume(@CurrentUser() user: JwtPayload) {
    return this.workSessionsService.resume(user.sub);
  }

  /**
   * sendBeacon / pagehide sırasında son durumu senkronize et
   * Auth header olmadan da çalışabilmesi için GET kullanılır (basit ping)
   */
  @Post('sync')
  sync(@CurrentUser() user: JwtPayload) {
    return this.workSessionsService.syncSession(user.sub);
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

  /**
   * Duraklatılmış oturumu sorgula (frontend "devam et" butonu gösterecek)
   */
  @Get('paused')
  getPaused(@CurrentUser() user: JwtPayload) {
    return this.workSessionsService.getPausedSession(user.sub);
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
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    // Tarihleri güvenli şekilde parse et, geçersizse varsayılan kullan
    const now = new Date();
    const parsedStart = startDate ? new Date(startDate) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const parsedEnd = endDate ? new Date(endDate) : now;
    return this.workSessionsService.getReports({
      startDate: isNaN(parsedStart.getTime()) ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) : parsedStart,
      endDate: isNaN(parsedEnd.getTime()) ? now : parsedEnd,
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
