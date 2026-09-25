import { Module } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { AdminProductsController, PublicProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [PublicProductsController, AdminProductsController],
  providers: [ProductsService, StorageService],
})
export class ProductsModule {}
