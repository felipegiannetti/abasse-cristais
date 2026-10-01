import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_COST = 12;
let dummyHash: Promise<string> | undefined;
// Hash "de mentira" para gastar o mesmo tempo quando o usuário não existe (evita enumeração por timing).
const getDummyHash = () => (dummyHash ??= hash('senha-inexistente', BCRYPT_COST));

const lockedError = () =>
  new HttpException(
    { code: 'TOO_MANY_ATTEMPTS', message: 'Too many failed attempts. Try again in a few minutes.' },
    HttpStatus.TOO_MANY_REQUESTS,
  );

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { username: username.trim().toLowerCase() },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) throw lockedError();

    const ok = await compare(password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !ok) {
      if (user) await this.registerFailure(user.id);
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' });
    }

    if (user.failedAttempts > 0 || user.lockedUntil) {
      await this.prisma.adminUser.update({
        where: { id: user.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    }

    return { token: await this.sign(user.id, user.tokenVersion), user: this.publicUser(user) };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: userId } });

    if (user.lockedUntil && user.lockedUntil > new Date()) throw lockedError();

    if (!(await compare(currentPassword, user.passwordHash))) {
      await this.registerFailure(user.id);
      throw new BadRequestException({ code: 'WRONG_CURRENT_PASSWORD', message: 'Current password is incorrect.' });
    }
    // bcrypt only uses the first 72 BYTES: longer inputs (multi-byte chars) would be silently truncated
    if (Buffer.byteLength(newPassword, 'utf8') > 72) {
      throw new BadRequestException({ code: 'PASSWORD_TOO_LONG', message: 'The new password is too long (max 72 bytes).' });
    }
    if (newPassword === currentPassword) {
      throw new BadRequestException({ code: 'SAME_PASSWORD', message: 'The new password must be different from the current one.' });
    }
    if (newPassword.toLowerCase().includes(user.username)) {
      throw new BadRequestException({ code: 'PASSWORD_CONTAINS_USERNAME', message: 'The new password cannot contain the username.' });
    }

    const updated = await this.prisma.adminUser.update({
      where: { id: user.id },
      data: {
        passwordHash: await hash(newPassword, BCRYPT_COST),
        mustChangePassword: false,
        tokenVersion: { increment: 1 }, // derruba qualquer outra sessão aberta
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    return { token: await this.sign(updated.id, updated.tokenVersion), user: this.publicUser(updated) };
  }

  /** Revokes the presented session (and any other copy of it) by bumping the token version. */
  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; tv: number }>(token, {
        algorithms: ['HS256'],
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
      });
      await this.prisma.adminUser.updateMany({
        where: { id: p.sub, tokenVersion: p.tv },
        data: { tokenVersion: { increment: 1 } },
      });
    } catch {
      // invalid/expired token: nothing to revoke
    }
  }

  /**
   * Revokes every session of this admin (including the one making this call) by bumping the token
   * version — the exact same mechanism a password change already triggers as a side effect. Exposed as
   * its own action for the "I lost my phone, kill every session now" moment, without requiring a new
   * password: unlike the team actions below, this only affects the caller's own account.
   */
  async signOutEverywhere(userId: string): Promise<void> {
    await this.prisma.adminUser.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  }

  /**
   * Step-up authentication for sensitive actions (creating/deleting admins, resetting passwords):
   * re-checks the acting admin's password (a stolen 60-day session alone is not enough) and feeds
   * the same per-account lockout as the login form.
   */
  async assertPassword(userId: string, password: string): Promise<void> {
    const user = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: userId } });
    if (user.lockedUntil && user.lockedUntil > new Date()) throw lockedError();
    if (!(await compare(password, user.passwordHash))) {
      await this.registerFailure(user.id);
      throw new BadRequestException({ code: 'WRONG_CURRENT_PASSWORD', message: 'Current password is incorrect.' });
    }
  }

  private async registerFailure(userId: string) {
    const u = await this.prisma.adminUser.update({
      where: { id: userId },
      data: { failedAttempts: { increment: 1 } },
    });
    if (u.failedAttempts >= config.maxFailedLogins) {
      await this.prisma.adminUser.update({
        where: { id: userId },
        data: {
          failedAttempts: 0,
          lockedUntil: new Date(Date.now() + config.lockMinutes * 60_000),
        },
      });
    }
  }

  private sign(userId: string, tokenVersion: number) {
    return this.jwt.signAsync(
      { sub: userId, tv: tokenVersion },
      {
        algorithm: 'HS256',
        expiresIn: `${config.sessionDays}d`,
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
      },
    );
  }

  private publicUser(u: { username: string; mustChangePassword: boolean }) {
    return { username: u.username, mustChangePassword: u.mustChangePassword };
  }
}
