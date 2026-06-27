import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { TasksModule } from './tasks/tasks.module';
import { FilesModule } from './files/files.module';
import { WorkSessionsModule } from './work-sessions/work-sessions.module';
import { AgentModule } from './agent/agent.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { SettingsModule } from './settings/settings.module';
import { MessagesModule } from './messages/messages.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { LeavesModule } from './leaves/leaves.module';
import { GroupsModule } from './groups/groups.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ShiftsModule } from './shifts/shifts.module';
import { ProjectsModule } from './projects/projects.module';
import { HolidaysModule } from './holidays/holidays.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10) * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    TasksModule,
    FilesModule,
    WorkSessionsModule,
    AgentModule,
    ReportsModule,
    NotificationsModule,
    AuditModule,
    SettingsModule,
    MessagesModule,
    AnnouncementsModule,
    LeavesModule,
    GroupsModule,
    WebhooksModule,
    ShiftsModule,
    ProjectsModule,
    HolidaysModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
