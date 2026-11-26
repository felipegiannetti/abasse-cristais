import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AdminNewsletterController, PublicNewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';

@Module({
  imports: [AuditModule],
  controllers: [PublicNewsletterController, AdminNewsletterController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
