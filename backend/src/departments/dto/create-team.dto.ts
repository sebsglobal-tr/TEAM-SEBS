import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  name!: string;

  @IsUUID()
  departmentId!: string;

  @IsUUID()
  @IsOptional()
  managerId?: string;
}
