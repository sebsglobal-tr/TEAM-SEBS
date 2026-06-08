import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { ActivityEventType } from '@prisma/client';

export class AgentEventDto {
  @IsUUID()
  @IsOptional()
  workSessionId?: string;

  @IsEnum(ActivityEventType)
  type!: ActivityEventType;

  @IsInt()
  @Min(0)
  @IsOptional()
  durationSeconds?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  timestamp?: string;
}
