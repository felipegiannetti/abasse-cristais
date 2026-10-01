import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { FinanceModule } from './finance/finance.module';
import { PrismaModule } from './prisma/prisma.service';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { SettingsModule } from './settings/settings.module';
import { TeamModule } from './team/team.module';

@Controller('health')
class HealthController {
  @Get()
  ok() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    // Limite geral por IP (em serverless o contador é por instância — é uma camada extra,
    // a proteção principal do login é o bloqueio por conta no banco).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    AuditModule,
    ProductsModule,
    SettingsModule,
    TeamModule,
    SalesModule,
    AnalyticsModule,
    FinanceModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
