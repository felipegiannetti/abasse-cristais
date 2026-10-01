import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AdminGuard } from '../auth/admin.guard';
import { AuditService } from './audit.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class ListAuditLogQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  entityType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/** "Quem mexeu em quê": a read-only feed of admin-made changes to business data. */
@Controller('admin/audit-log')
@UseGuards(AdminGuard)
@SkipThrottle() // session-protected (see AdminProductsController)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() q: ListAuditLogQuery) {
    return this.audit.list({ page: q.page ?? 1, pageSize: q.pageSize ?? 30, entityType: q.entityType });
  }
}
