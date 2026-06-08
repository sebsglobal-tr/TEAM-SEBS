import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ReportType } from '@prisma/client';

export class CreateReportDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ReportType)
  @IsOptional()
  reportType?: ReportType;
}
