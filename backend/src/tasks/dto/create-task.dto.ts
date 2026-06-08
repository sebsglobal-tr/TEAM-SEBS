import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskPriority, TaskStatus } from '@prisma/client';

export class SplitSubtaskDto {
  @IsString()
  title!: string;

  @IsUUID()
  @IsOptional()
  assignedToId?: string;
}

export class AssignTaskDto {
  @IsUUID()
  assigneeId!: string;
}

export class SplitTaskDto {
  @ValidateNested({ each: true })
  @Type(() => SplitSubtaskDto)
  @ArrayMinSize(1)
  subtasks!: SplitSubtaskDto[];
}

export class UpdateStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CreateTaskDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedMinutes?: number;

  @IsUUID()
  @IsOptional()
  parentTaskId?: string;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  dueDate?: string;

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
