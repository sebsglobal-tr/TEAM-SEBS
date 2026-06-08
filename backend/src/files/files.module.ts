import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [FilesController],
  providers: [FilesService, LocalStorageProvider],
  exports: [FilesService],
})
export class FilesModule {}
