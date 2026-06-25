import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('projects')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  create(@Body() dto: { name: string; description?: string; color?: string; startDate?: string; endDate?: string }, @CurrentUser() user: JwtPayload) {
    return this.projectsService.create(dto, user);
  }

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  update(@Param('id') id: string, @Body() dto: { name?: string; description?: string; status?: string; color?: string }) {
    return this.projectsService.update(id, dto);
  }
}
