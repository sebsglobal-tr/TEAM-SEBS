import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TaskStatus } from '@prisma/client';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  completionPercent?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  actualMinutes?: number;
}
