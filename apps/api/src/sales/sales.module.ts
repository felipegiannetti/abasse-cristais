import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CustomersService } from './customers.service';
import { CustomersController, SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [AuditModule],
  controllers: [SalesController, CustomersController],
  providers: [SalesService, CustomersService],
})
export class SalesModule {}
