import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FilesModule } from '../files/files.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    MulterModule.register({
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
    FilesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
