import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post()
  create(@Body() dto: { url: string; events: string[] }, @CurrentUser() user: JwtPayload) {
    return this.webhooksService.create(dto.url, dto.events, user.sub);
  }

  @Get()
  findAll() {
    return this.webhooksService.findAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.webhooksService.remove(id);
  }
}
