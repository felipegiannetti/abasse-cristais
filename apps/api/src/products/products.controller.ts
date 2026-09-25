import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { config } from '../config';
import { AdminGuard } from '../auth/admin.guard';
import {
  CreateProductDto,
  ListProductsQuery,
  ReorderImagesDto,
  UpdateProductDto,
} from './products.dto';
import { ProductsService } from './products.service';

/** Catálogo público (somente leitura). */
@Controller('products')
export class PublicProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: ListProductsQuery) {
    return this.products.list(query, { admin: false });
  }

  @Get('categories')
  categories() {
    return this.products.categories();
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.products.findBySlug(slug);
  }
}

/** Gestão de produtos — exige sessão de admin (e senha já trocada). */
@Controller('admin/products')
@UseGuards(AdminGuard)
@SkipThrottle() // session-protected; a per-IP bucket shared behind the proxy would let outsiders block the admin
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: ListProductsQuery) {
    return this.products.list({ pageSize: 100, ...query }, { admin: true });
  }

  @Get('categories')
  categories() {
    return this.products.allCategoryNames();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.products.findById(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }

  @Post(':id/images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: config.maxImageBytes, files: 1, fields: 0, parts: 2 } }))
  addImage(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.products.addImage(id, file);
  }

  @Put(':id/images/order')
  reorderImages(@Param('id') id: string, @Body() dto: ReorderImagesDto) {
    return this.products.reorderImages(id, dto.ids);
  }

  @Delete(':id/images/:imageId')
  @HttpCode(204)
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.products.removeImage(id, imageId);
  }
}
