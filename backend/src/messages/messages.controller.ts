import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('messages')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post()
  send(
    @Body() dto: { receiverId: string; message: string; replyToId?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.send(dto.receiverId, dto.message, user.sub, dto.replyToId);
  }

  @Get('conversations')
  getConversations(@CurrentUser() user: JwtPayload) {
    return this.messagesService.getConversations(user.sub);
  }

  @Get('conversation/:userId')
  getConversation(
    @Param('userId') otherUserId: string,
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.getConversation(
      user.sub,
      otherUserId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.messagesService.getUnreadCount(user.sub);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.messagesService.markAsRead(id, user.sub);
  }

  @Patch('read-all/:userId')
  markAllAsRead(@Param('userId') otherUserId: string, @CurrentUser() user: JwtPayload) {
    return this.messagesService.markAllAsRead(user.sub, otherUserId);
  }
}
