import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('settings')
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANAGER)
  findAll() {
    return this.settingsService.findAll();
  }

  @Patch()
  @Roles(UserRole.SUPER_ADMIN)
  update(@Body() body: { settings: Array<{ key: string; value: string }> }, @CurrentUser() user: JwtPayload) {
    return this.settingsService.bulkUpdate(body.settings, user);
  }
}
