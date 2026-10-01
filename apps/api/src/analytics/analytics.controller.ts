import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { AdminGuard } from '../auth/admin.guard';
import { AnalyticsService } from './analytics.service';

export const WA_SOURCES = ['MENU', 'FLOATING', 'FOOTER', 'HERO', 'HOME_CTA', 'CATALOG', 'PRODUCT_CARD', 'PRODUCT_PAGE', 'QR_CODE'] as const;
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
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('click')
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  click(@Body() dto: TrackClickDto) {
    return this.analytics.trackClick(dto);
  }
}

/** Numbers about the WhatsApp clicks and the manual confirmation of conversations. Admin only. */
@Controller('admin/analytics')
@UseGuards(AdminGuard)
@SkipThrottle()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('clicks')
  clicks(@Query() q: ClicksQuery) {
    return this.analytics.clicks(q.days ?? 30);
  }

  @Post('confirm')
  @HttpCode(200)
  confirm(@Body() dto: ConfirmDto) {
    return this.analytics.confirm(dto.ref);
  }
}
