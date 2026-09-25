import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import type { AdminRequestUser } from '../auth/auth.decorators';
import { TeamService } from './team.service';

type AdminRequest = Request & { admin: AdminRequestUser };

class ConfirmDto {
  /** Step-up authentication: the acting admin must retype their own password. */
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword: string;
}

class CreateAdminDto extends ConfirmDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9._-]{2,31}$/, {
    message: 'Username: 3 to 32 characters (letters, numbers, dot, dash or underscore).',
  })
  username: string;
}

/** Management of the admin accounts. Only a logged-in admin (password already changed) can reach it. */
@Controller('admin/team')
@UseGuards(AdminGuard)
@SkipThrottle() // session-protected; password guesses are stopped by the per-account lockout
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  list(@Req() req: AdminRequest) {
    return this.team.list(req.admin.id);
  }

  @Post()
  create(@Req() req: AdminRequest, @Body() dto: CreateAdminDto) {
    return this.team.create(req.admin.id, dto.username, dto.currentPassword);
  }

  // POST (not DELETE) because a body is needed and proxies may drop bodies on DELETE requests
  @Post(':id/delete')
  @HttpCode(204)
  remove(@Req() req: AdminRequest, @Param('id') id: string, @Body() dto: ConfirmDto) {
    return this.team.remove(req.admin.id, id, dto.currentPassword);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  reset(@Req() req: AdminRequest, @Param('id') id: string, @Body() dto: ConfirmDto) {
    return this.team.resetPassword(req.admin.id, id, dto.currentPassword);
  }
}
