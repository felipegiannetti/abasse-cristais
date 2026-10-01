import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ImagesController } from './images.controller';
import { AdminProductsController, PublicProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [AuditModule],
  controllers: [PublicProductsController, AdminProductsController, ImagesController],
  providers: [ProductsService],
})
export class ProductsModule {}
