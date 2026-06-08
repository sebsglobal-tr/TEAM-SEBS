import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskPriority, TaskStatus, TaskType } from '@prisma/client';

export class CreateSubtaskDto {
  @IsString()
  title!: string;

  @IsUUID()
  @IsOptional()
  assignedToId?: string;
}

export class CreateBulkTaskDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskType)
  @IsOptional()
  taskType?: TaskType;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsUUID()
  @IsOptional()
  responsibleManagerId?: string;

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedMinutes?: number;
}

export class AssignTaskDto {
  @IsUUID()
  assigneeId!: string;
}

export class SplitTaskDto {
  @ValidateNested({ each: true })
  @Type(() => CreateSubtaskDto)
  @ArrayMinSize(1)
  subtasks!: CreateSubtaskDto[];
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

  @IsEnum(TaskType)
  @IsOptional()
  taskType?: TaskType;

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
  responsibleManagerId?: string;

  @IsUUID()
  @IsOptional()
  parentTaskId?: string;

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
}

export class CreateCommentDto {
  @IsString()
  message!: string;

  @IsString()
  @IsOptional()
  commentType?: string;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskType)
  @IsOptional()
  taskType?: TaskType;

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
  responsibleManagerId?: string;

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
