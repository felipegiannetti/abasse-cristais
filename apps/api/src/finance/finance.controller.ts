import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IsIn, IsOptional } from 'class-validator';
import { AdminGuard } from '../auth/admin.guard';
import { FinanceService, type SummaryRange } from './finance.service';

class SummaryQuery {
  @IsOptional()
  @IsIn(['7', '30', '90', '365', 'all'])
  range?: SummaryRange;
}

/** Financial dashboard numbers. Admin only. */
@Controller('admin/finance')
@UseGuards(AdminGuard)
@SkipThrottle()
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  summary(@Query() q: SummaryQuery) {
    return this.finance.summary(q.range ?? '30');
  }
}
