import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { HolidaysService } from './holidays.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('holidays')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class HolidaysController {
  constructor(private holidaysService: HolidaysService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: { name: string; date: string; type?: string; isHalfDay?: boolean }) {
    return this.holidaysService.create(dto);
  }

  @Get()
  findAll(@Query('year') year?: string) {
    return this.holidaysService.findAll(year ? parseInt(year) : undefined);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }
}
