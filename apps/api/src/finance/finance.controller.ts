import { Controller, Get, Query, Req, Res, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { IsIn, IsOptional } from 'class-validator';
import { AdminGuard } from '../auth/admin.guard';
import type { AdminRequestUser } from '../auth/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { FxService } from '../fx/fx.service';
import { financeCsv, financePdf } from './finance-export';
import { FinanceService, type SummaryRange } from './finance.service';

type AdminRequest = Request & { admin: AdminRequestUser };

const RANGES = ['7', '30', '90', '365', 'all'] as const;

class SummaryQuery {
  @IsOptional()
  @IsIn(RANGES)
  range?: SummaryRange;
}

class ExportQuery extends SummaryQuery {
  @IsIn(['csv', 'pdf'])
  format: 'csv' | 'pdf';

  /** Money is stored in dollars; BRL converts with the current exchange rate (stated in the report). */
  @IsOptional()
  @IsIn(['USD', 'BRL'])
  currency?: 'USD' | 'BRL';
}

const SOURCE_NOTE = { BCB_PTAX: 'cotação oficial do Banco Central (PTAX)', AWESOMEAPI: 'cotação de mercado (AwesomeAPI)' } as const;

/** Financial dashboard numbers. Admin only. */
@Controller('admin/finance')
@UseGuards(AdminGuard)
@SkipThrottle()
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly fx: FxService,
    private readonly audit: AuditService,
  ) {}

  @Get('summary')
  summary(@Query() q: SummaryQuery) {
    return this.finance.summary(q.range ?? '30');
  }

  /** The same numbers as the dashboard, as a CSV (spreadsheet) or a PDF (printable report). */
  @Get('export')
  async export(@Req() req: AdminRequest, @Query() q: ExportQuery, @Res() res: Response) {
    const range = q.range ?? '30';
    const currency = q.currency ?? 'USD';
    let rate: number | null = null;
    let rateNote = '';
    if (currency === 'BRL') {
      const fx = await this.fx.current();
      if (!fx) throw new ServiceUnavailableException({ code: 'FX_UNAVAILABLE', message: 'The exchange rate is unavailable right now. Try again in a moment.' });
      rate = fx.rate;
      const when = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(fx.asOf);
      rateNote = `${SOURCE_NOTE[fx.source]} de ${when}`;
    }
    const summary = await this.finance.summary(range);
    const options = { currency, rate, rateNote, generatedAt: new Date() };
    const day = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
    const body = q.format === 'pdf' ? await financePdf(summary, options) : Buffer.from('﻿' + financeCsv(summary, options), 'utf8');
    await this.audit.record({ actorId: req.admin.id, action: 'finance.export', entityType: 'Finance', summary: `Exportou o financeiro (${range === 'all' ? 'tudo' : `${range} dias`}, ${currency}) em ${q.format.toUpperCase()}` });
    res
      .status(200)
      .setHeader('Content-Type', q.format === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="financeiro-${range}-${currency}-${day}.${q.format}"`)
      .setHeader('Content-Length', body.length)
      .setHeader('Cache-Control', 'private, no-store')
      .setHeader('X-Content-Type-Options', 'nosniff')
      .end(body);
  }
}
