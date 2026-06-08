import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AgentService } from './agent.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { AgentEventDto } from './dto/agent-event.dto';
import { SyncDto } from './dto/sync.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('agent')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class AgentController {
  constructor(private agentService: AgentService) {}

  @Post('heartbeat')
  heartbeat(@CurrentUser() user: JwtPayload, @Body() dto: HeartbeatDto) {
    return this.agentService.processHeartbeat(user.sub, dto);
  }

  @Post('event')
  event(@CurrentUser() user: JwtPayload, @Body() dto: AgentEventDto) {
    return this.agentService.processEvent(user.sub, dto);
  }

  @Post('sync')
  sync(@CurrentUser() user: JwtPayload, @Body() dto: SyncDto) {
    return this.agentService.sync(user.sub, dto.heartbeats, dto.events);
  }

  @Get('settings')
  getSettings() {
    return this.agentService.getSettings();
  }
}
