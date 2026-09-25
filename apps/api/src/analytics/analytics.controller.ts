import { Body, Controller, Get, HttpCode, NotFoundException, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { AdminGuard } from '../auth/admin.guard';
import { PrismaService } from '../prisma/prisma.service';

export const WA_SOURCES = ['MENU', 'FLOATING', 'FOOTER', 'HERO', 'HOME_CTA', 'CATALOG', 'PRODUCT_CARD', 'PRODUCT_PAGE'] as const;
const LOCALES = ['en', 'pt', 'es'] as const;
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

class TrackClickDto {
  /** Short code printed in the WhatsApp message (no ambiguous characters: no 0/1/O/I). */
  @Transform(upper)
  @Matches(/^[A-Z2-9]{6}$/)
  ref: string;

  @IsIn(WA_SOURCES)
  source: (typeof WA_SOURCES)[number];

  /** Page path only (no query string, no personal data). */
  @Matches(/^\/[\w\-./%]{0,198}$/)
  path: string;

  @IsOptional()
  @Matches(/^[a-z0-9][a-z0-9-]{0,99}$/)
  productSlug?: string;

  @IsIn(LOCALES)
  locale: (typeof LOCALES)[number];
}

class ConfirmDto {
  @Transform(upper)
  @Matches(/^[A-Z2-9]{6}$/, { message: 'Invalid reference code.' })
  ref: string;
}

class ClicksQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

/**
 * Counts clicks on WhatsApp buttons. Public on purpose (the visitor is anonymous), so it is deliberately
 * minimal: whitelisted fields only, no IP / user agent / cookies stored, duplicates ignored, rate limited.
 */
@Controller('track')
export class TrackController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('click')
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async click(@Body() dto: TrackClickDto) {
    await this.prisma.whatsAppClick.createMany({
      data: [{ ref: dto.ref, source: dto.source, path: dto.path, productSlug: dto.productSlug ?? null, locale: dto.locale }],
      skipDuplicates: true, // the same ref twice (double click / retry) counts once
    });
  }
}

/** Numbers about the WhatsApp clicks and the manual confirmation of conversations. Admin only. */
@Controller('admin/analytics')
@UseGuards(AdminGuard)
@SkipThrottle()
export class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('clicks')
  async clicks(@Query() q: ClicksQuery) {
    const days = q.days ?? 30;
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.prisma.whatsAppClick.findMany({
      where: { createdAt: { gte: since } },
      select: { source: true, productSlug: true, createdAt: true, confirmedAt: true },
      take: 50_000,
    });

    const bySource = new Map<string, number>();
    const bySlug = new Map<string, number>();
    const daily = new Map<string, { count: number; confirmed: number }>();
    let confirmed = 0;
    for (const r of rows) {
      bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
      if (r.productSlug) bySlug.set(r.productSlug, (bySlug.get(r.productSlug) ?? 0) + 1);
      const key = new Date(r.createdAt.getTime() - 3 * 3_600_000).toISOString().slice(0, 10); // Brazil time (UTC-3)
      const d = daily.get(key) ?? { count: 0, confirmed: 0 };
      d.count += 1;
      if (r.confirmedAt) {
        d.confirmed += 1;
        confirmed += 1;
      }
      daily.set(key, d);
    }

    const topSlugs = [...bySlug].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const names = new Map(
      (await this.prisma.product.findMany({ where: { slug: { in: topSlugs.map(([s]) => s) } }, select: { slug: true, name: true } })).map((p) => [p.slug, p.name]),
    );
    return {
      days,
      total: rows.length,
      confirmed,
      bySource: [...bySource].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
      topProducts: topSlugs.map(([slug, count]) => ({ slug, name: names.get(slug) ?? slug, count })),
      daily: [...daily].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /** The admin types the "Ref: XXXXXX" code from a WhatsApp conversation to mark it as received. */
  @Post('confirm')
  @HttpCode(200)
  async confirm(@Body() dto: ConfirmDto) {
    const click = await this.prisma.whatsAppClick.findUnique({ where: { ref: dto.ref } });
    if (!click) throw new NotFoundException({ code: 'CLICK_NOT_FOUND', message: 'No click found for this code.' });
    const already = click.confirmedAt !== null;
    if (!already) await this.prisma.whatsAppClick.update({ where: { id: click.id }, data: { confirmedAt: new Date() } });
    return { ref: click.ref, source: click.source, path: click.path, productSlug: click.productSlug, clickedAt: click.createdAt, alreadyConfirmed: already };
  }
}
