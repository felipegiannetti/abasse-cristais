import { Controller, Get, Headers, NotFoundException, Param, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { SessionService } from '../auth/session.service';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const notFound = () => new NotFoundException({ code: 'IMAGE_NOT_FOUND', message: 'Image not found.' });

// Photos are immutable per id, but a deleted/hidden photo must not linger in shared caches for long.
const PUBLIC_CACHE = 'public, max-age=86400, s-maxage=86400';
const PRIVATE_CACHE = 'private, no-store';

/**
 * Serves images stored in the database.
 *  - Photos of visible products are public (they are catalogue photos).
 *  - Photos of HIDDEN products are only returned to a logged-in admin (draft products must not leak
 *    through a guessed/leaked id) and are never cacheable by shared caches.
 * Responses are locked down: fixed image/* type from the allow-list, nosniff and a sandboxed CSP.
 */
@Controller('images')
// The site's image optimizer fetches from one IP, so use a generous limit instead of the default.
@Throttle({ default: { limit: 1200, ttl: 60_000 } })
export class ImagesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // cuid ids only: rejects anything else before touching the database
    if (!/^[a-z0-9]{20,32}$/.test(id)) throw notFound();

    // 1) metadata only (no bytes): existence + visibility
    const meta = await this.prisma.productImage.findUnique({
      where: { id },
      select: { mimeType: true, product: { select: { status: true } } },
    });
    if (!meta || !EXT[meta.mimeType]) throw notFound();

    const hidden = meta.product.status === 'HIDDEN';
    if (hidden && !(await this.sessions.resolve(req.cookies?.[config.cookieName]))) throw notFound();

    res
      .setHeader('Cache-Control', hidden ? PRIVATE_CACHE : PUBLIC_CACHE)
      .setHeader('X-Content-Type-Options', 'nosniff')
      .setHeader('Content-Security-Policy', "default-src 'none'; sandbox");

    const etag = `"${id}"`;
    if (!hidden && ifNoneMatch === etag) return res.status(304).setHeader('ETag', etag).end();

    // 2) the bytes
    const img = await this.prisma.productImage.findUnique({ where: { id }, select: { data: true } });
    if (!img) throw notFound();
    const body = Buffer.from(img.data);
    res
      .status(200)
      .setHeader('Content-Type', meta.mimeType)
      .setHeader('Content-Length', body.length)
      .setHeader('Content-Disposition', `inline; filename="image.${EXT[meta.mimeType]}"`);
    if (!hidden) res.setHeader('ETag', etag);
    res.end(body);
  }
}
