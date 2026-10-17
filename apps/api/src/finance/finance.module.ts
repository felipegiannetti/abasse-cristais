import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { FxModule } from '../fx/fx.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({ imports: [AuditModule, FxModule], controllers: [FinanceController], providers: [FinanceService], exports: [FinanceService] })
export class FinanceModule {}
