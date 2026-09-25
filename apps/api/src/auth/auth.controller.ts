import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { config } from '../config';
import { AdminGuard } from './admin.guard';
import { AdminRequestUser, AllowWhenPasswordChangeRequired } from './auth.decorators';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { AuthService } from './auth.service';

type AdminRequest = Request & { admin: AdminRequestUser };

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax',
  path: '/',
});

const setSession = (res: Response, token: string) =>
  res.cookie(config.cookieName, token, {
    ...cookieOptions(),
    maxAge: config.sessionDays * 86_400_000,
  });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.login(dto.username, dto.password);
    setSession(res, token);
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(config.cookieName, cookieOptions());
  }

  @Get('me')
  @UseGuards(AdminGuard)
  @AllowWhenPasswordChangeRequired()
  me(@Req() req: AdminRequest) {
    return { username: req.admin.username, mustChangePassword: req.admin.mustChangePassword };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  @AllowWhenPasswordChangeRequired()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async changePassword(
    @Req() req: AdminRequest,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.auth.changePassword(
      req.admin.id,
      dto.currentPassword,
      dto.newPassword,
    );
    setSession(res, token);
    return user;
  }
}
