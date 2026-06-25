import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('shifts')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  create(@Body() dto: { userId: string; type: string; date: string; startTime: string; endTime?: string }) {
    return this.shiftsService.create(dto);
  }

  @Get()
  getByDateRange(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.shiftsService.getByDateRange(startDate, endDate);
  }

  @Get('my')
  getMyShifts(@CurrentUser() user: JwtPayload) {
    return this.shiftsService.getMyShifts(user.sub);
  }
}
