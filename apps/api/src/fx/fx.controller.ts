import { Controller, Get, Header, ServiceUnavailableException } from '@nestjs/common';
import { FxService } from './fx.service';

/**
 * The USD→BRL rate the public site uses to show prices in reais. Public on purpose (it is the same number
 * printed on every page) and cacheable for a few minutes; the global per-IP limiter still applies.
 */
@Controller('fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Get('usd-brl')
  @Header('Cache-Control', 'public, max-age=300')
  async usdBrl() {
    const r = await this.fx.current();
    if (!r) throw new ServiceUnavailableException({ code: 'FX_UNAVAILABLE', message: 'No exchange rate available yet.' });
    return { base: r.base, quote: r.quote, rate: r.rate, source: r.source, asOf: r.asOf, fetchedAt: r.fetchedAt, stale: r.stale, previousRate: r.previousRate };
  }
}
