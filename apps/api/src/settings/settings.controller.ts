import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminGuard } from '../auth/admin.guard';
import { SettingsService } from './settings.service';

class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  // { locale: { field: text } } — shape and content are checked by SettingsService.normalizeTemplates,
  // which also enforces the known locale/field names and a length cap per field.
  @IsOptional()
  @IsObject()
  templates?: Record<string, unknown>;
}

/** Read by the public site (which contact channels every button uses). */
@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('public')
  async publicSettings() {
    return this.settings.getContact();
  }
}

/** Edited by any logged-in admin. */
@Controller('admin/settings')
@UseGuards(AdminGuard)
@SkipThrottle()
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async get() {
    return this.settings.getContact();
  }

  @Put()
  async update(@Body() dto: UpdateSettingsDto) {
    return this.settings.updateContact(dto);
  }
}
