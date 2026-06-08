import { IsEnum, IsOptional } from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class WebHeartbeatDto {
  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;
}
