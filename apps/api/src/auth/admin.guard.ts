import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { config } from '../config';
import { ALLOW_PASSWORD_CHANGE, AdminRequestUser } from './auth.decorators';
import { SessionService } from './session.service';

type AdminRequest = Request & { admin?: AdminRequestUser };

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const user = await this.sessions.resolve(req.cookies?.[config.cookieName]);
    if (!user) throw new UnauthorizedException();

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (user.mustChangePassword && !allowed) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must change the initial password before continuing.',
      });
    }

    req.admin = { id: user.id, username: user.username, mustChangePassword: user.mustChangePassword };
    return true;
  }
}
