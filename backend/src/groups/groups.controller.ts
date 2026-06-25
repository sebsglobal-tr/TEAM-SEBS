import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('groups')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Post()
  create(@Body('name') name: string, @CurrentUser() user: JwtPayload) {
    return this.groupsService.create(name, user);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.groupsService.findAll(user);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body('userId') userId: string, @CurrentUser() user: JwtPayload) {
    return this.groupsService.addMember(id, userId, user);
  }

  @Post(':id/messages')
  sendMessage(@Param('id') id: string, @Body('message') message: string, @CurrentUser() user: JwtPayload) {
    return this.groupsService.sendMessage(id, message, user);
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.groupsService.getMessages(id, user);
  }
}
