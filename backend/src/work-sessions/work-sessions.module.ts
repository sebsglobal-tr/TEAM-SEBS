import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkSessionsService } from './work-sessions.service';
import { WorkSessionsController } from './work-sessions.controller';
import { StatusSyncService } from './status-sync.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ScheduleModule.forRoot(), AuditModule, NotificationsModule],
  controllers: [WorkSessionsController],
  providers: [WorkSessionsService, StatusSyncService],
  exports: [WorkSessionsService],
})
export class WorkSessionsModule {}
