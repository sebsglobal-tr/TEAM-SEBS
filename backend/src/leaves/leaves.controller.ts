import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { LeavesService } from './leaves.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('leaves')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class LeavesController {
  constructor(private leavesService: LeavesService) {}

  @Post()
  create(@Body() dto: { leaveType: string; startDate: string; endDate: string; reason?: string }, @CurrentUser() user: JwtPayload) {
    return this.leavesService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.leavesService.findAll(user);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  updateStatus(@Param('id') id: string, @Body() dto: { status: string; rejectionReason?: string }, @CurrentUser() user: JwtPayload) {
    return this.leavesService.updateStatus(id, dto.status, dto.rejectionReason, user);
  }
}
