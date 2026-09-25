import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { ALLOW_PASSWORD_CHANGE, AdminRequestUser } from './auth.decorators';

type AdminRequest = Request & { admin?: AdminRequestUser };

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const token = req.cookies?.[config.cookieName];
    if (typeof token !== 'string' || !token) throw new UnauthorizedException();

    let payload: { sub: string; tv: number };
    try {
      payload = await this.jwt.verifyAsync(token, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException();
    }

    // Consulta o banco a cada requisição: troca de senha/reset invalida sessões antigas.
    const user = await this.prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!user || user.tokenVersion !== payload.tv) throw new UnauthorizedException();

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
