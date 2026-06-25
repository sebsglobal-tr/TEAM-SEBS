import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { SupabaseStorageProvider } from './storage/supabase-storage.provider';
import { STORAGE_PROVIDER } from './storage/tokens';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    {
      provide: STORAGE_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const type = configService.get<string>('STORAGE_TYPE', 'local');
        if (type === 'supabase') {
          return new SupabaseStorageProvider(configService);
        }
        return new LocalStorageProvider(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [FilesService, STORAGE_PROVIDER],
})
export class FilesModule {}
