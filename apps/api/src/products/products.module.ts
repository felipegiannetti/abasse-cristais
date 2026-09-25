import { Module } from '@nestjs/common';
import { ImagesController } from './images.controller';
import { AdminProductsController, PublicProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [PublicProductsController, AdminProductsController, ImagesController],
  providers: [ProductsService],
})
export class ProductsModule {}
