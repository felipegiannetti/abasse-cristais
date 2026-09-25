import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AdminUser } from '@prisma/client';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Single place that turns the session cookie into an admin user. Used by the guard (protected routes)
 * and by endpoints that behave differently for admins (e.g. previews of hidden products' photos).
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /** Returns the admin for a valid, non-revoked session token, otherwise null. Never throws. */
  async resolve(token: unknown): Promise<AdminUser | null> {
    if (typeof token !== 'string' || !token) return null;
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; tv: number }>(token, {
        algorithms: ['HS256'], // fixed algorithm: no alg=none / HS-RS confusion
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
      });
      // Checked against the database on every use: password change/logout/reset revoke old tokens.
      const user = await this.prisma.adminUser.findUnique({ where: { id: p.sub } });
      return user && user.tokenVersion === p.tv ? user : null;
    } catch {
      return null;
    }
  }
}
