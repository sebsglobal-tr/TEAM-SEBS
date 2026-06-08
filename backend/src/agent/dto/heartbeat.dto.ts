import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class HeartbeatDto {
  @IsUUID()
  @IsOptional()
  workSessionId?: string;

  @IsEnum(EmployeeStatus)
  status!: EmployeeStatus;

  @IsInt()
  @Min(0)
  @IsOptional()
  idleSeconds?: number;

  @IsString()
  @IsOptional()
  clientVersion?: string;
}
