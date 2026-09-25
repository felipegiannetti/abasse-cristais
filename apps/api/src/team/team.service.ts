import { randomBytes } from 'crypto';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_COST = 12;
/** 16 random url-safe characters (96 bits). Shown once; the new admin must replace it at first login. */
const tempPassword = () => randomBytes(12).toString('base64url');

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async list(actorId: string) {
    const users = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, username: true, createdAt: true, mustChangePassword: true, createdById: true },
    });
    const names = new Map(users.map((u) => [u.id, u.username]));
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      createdAt: u.createdAt,
      mustChangePassword: u.mustChangePassword,
      createdBy: u.createdById ? (names.get(u.createdById) ?? null) : null,
      isYou: u.id === actorId,
    }));
  }

  /** Every admin has the same permissions: there are no roles to escalate between. */
  async create(actorId: string, username: string, currentPassword: string) {
    await this.auth.assertPassword(actorId, currentPassword); // step-up: re-authenticate the actor
    const password = tempPassword();
    try {
      const user = await this.prisma.adminUser.create({
        data: {
          username,
          passwordHash: await hash(password, BCRYPT_COST),
          mustChangePassword: true,
          createdById: actorId,
        },
        select: { id: true, username: true, createdAt: true, mustChangePassword: true },
      });
      this.logger.log(`admin ${actorId} created admin ${user.id}`);
      return { user, temporaryPassword: password };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'USERNAME_TAKEN', message: 'That username is already in use.' });
      }
      throw e;
    }
  }

  async remove(actorId: string, id: string, currentPassword: string) {
    await this.auth.assertPassword(actorId, currentPassword);
    if (id === actorId) {
      throw new BadRequestException({ code: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own account.' });
    }
    await this.prisma.$transaction(async (tx) => {
      // Lock every admin row so two admins deleting each other at the same time cannot leave zero admins.
      await tx.$queryRaw`SELECT id FROM "AdminUser" FOR UPDATE`;
      if ((await tx.adminUser.count()) <= 1) {
        throw new BadRequestException({ code: 'LAST_ADMIN', message: 'The last admin cannot be deleted.' });
      }
      const { count } = await tx.adminUser.deleteMany({ where: { id } });
      if (!count) throw new NotFoundException({ code: 'ADMIN_NOT_FOUND', message: 'Admin not found.' });
    });
    this.logger.log(`admin ${actorId} deleted admin ${id}`); // the deleted user's sessions die with the row
  }

  async resetPassword(actorId: string, id: string, currentPassword: string) {
    await this.auth.assertPassword(actorId, currentPassword);
    if (id === actorId) {
      throw new BadRequestException({ code: 'USE_CHANGE_PASSWORD', message: 'Use "Change password" for your own account.' });
    }
    const password = tempPassword();
    const { count } = await this.prisma.adminUser.updateMany({
      where: { id },
      data: {
        passwordHash: await hash(password, BCRYPT_COST),
        mustChangePassword: true,
        tokenVersion: { increment: 1 }, // logs the target out everywhere
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    if (!count) throw new NotFoundException({ code: 'ADMIN_NOT_FOUND', message: 'Admin not found.' });
    this.logger.log(`admin ${actorId} reset the password of admin ${id}`);
    return { temporaryPassword: password };
  }
}
