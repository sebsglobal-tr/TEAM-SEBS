import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { HeartbeatDto } from './heartbeat.dto';
import { AgentEventDto } from './agent-event.dto';

export class SyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HeartbeatDto)
  heartbeats!: HeartbeatDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentEventDto)
  events!: AgentEventDto[];
}
