import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AdminSettingsController, PublicSettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuditModule],
  controllers: [PublicSettingsController, AdminSettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
