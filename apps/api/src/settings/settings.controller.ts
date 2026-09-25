import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminGuard } from '../auth/admin.guard';
import { SettingsService } from './settings.service';

class UpdateSettingsDto {
  @IsString()
  @MaxLength(200)
  whatsapp: string;
}

/** Read by the public site (the WhatsApp number every button uses). */
@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('public')
  async publicSettings() {
    return { whatsapp: await this.settings.getWhatsapp() };
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
    return { whatsapp: await this.settings.getWhatsapp() };
  }

  @Put()
  async update(@Body() dto: UpdateSettingsDto) {
    return { whatsapp: await this.settings.setWhatsapp(dto.whatsapp) };
  }
}
