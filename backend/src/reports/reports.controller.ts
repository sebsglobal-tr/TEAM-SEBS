import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('daily')
  getDaily(
    @Query('date') date: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reportsService.getDailyReport(new Date(date), departmentId);
  }

  @Get('weekly')
  getWeekly(
    @Query('weekStart') weekStart: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reportsService.getWeeklyReport(new Date(weekStart), departmentId);
  }

  @Get('monthly')
  getMonthly(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reportsService.getMonthlyReport(
      parseInt(year, 10),
      parseInt(month, 10),
      departmentId,
    );
  }

  @Get('users/:id')
  getUserReport(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getUserReport(id, new Date(startDate), new Date(endDate));
  }

  @Get('departments/:id')
  getDepartmentReport(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getDepartmentReport(id, new Date(startDate), new Date(endDate));
  }

  @Get('overview')
  getOverview(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reportsService.getOverview(
      new Date(startDate),
      new Date(endDate),
      departmentId,
    );
  }

  @Get('tasks')
  getTaskReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reportsService.getTaskCompletionReport(
      new Date(startDate),
      new Date(endDate),
      departmentId,
    );
  }
}
