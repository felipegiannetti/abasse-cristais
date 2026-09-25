import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import type { AdminRequestUser } from '../auth/auth.decorators';
import { config } from '../config';
import { CustomersService } from './customers.service';
import {
  ConfirmPasswordDto,
  CreateCustomerDto,
  CreateSaleDto,
  ListCustomersQuery,
  ListSalesQuery,
  UpdateCustomerDto,
  UpdateSaleDto,
} from './sales.dto';
import { SalesService } from './sales.service';

type AdminRequest = Request & { admin: AdminRequestUser };

/** Sales registry. Admin only. */
@Controller('admin/sales')
@UseGuards(AdminGuard)
@SkipThrottle() // session-protected (see AdminProductsController)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  list(@Query() q: ListSalesQuery) {
    return this.sales.list(q);
  }

  // declared before ':id' so "photos" is not taken for an id
  @Get('photos/:photoId')
  async photo(@Param('photoId') photoId: string, @Res() res: Response) {
    const { data, mimeType } = await this.sales.getPhoto(photoId);
    res
      .status(200)
      .setHeader('Content-Type', mimeType)
      .setHeader('Content-Length', data.length)
      .setHeader('Cache-Control', 'private, no-store')
      .setHeader('X-Content-Type-Options', 'nosniff')
      .setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
      .end(data);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.sales.findOne(id);
  }

  @Post()
  create(@Req() req: AdminRequest, @Body() dto: CreateSaleDto) {
    return this.sales.create(req.admin.id, dto);
  }

  @Patch(':id')
  update(@Req() req: AdminRequest, @Param('id') id: string, @Body() dto: UpdateSaleDto) {
    return this.sales.update(req.admin.id, id, dto);
  }

  @Post(':id/photos')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: config.maxImageBytes, files: 1, fields: 0, parts: 2 } }))
  addPhoto(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.sales.addPhoto(id, file);
  }

  @Delete(':id/photos/:photoId')
  @HttpCode(204)
  removePhoto(@Param('id') id: string, @Param('photoId') photoId: string) {
    return this.sales.removePhoto(id, photoId);
  }
}

/** Customers (personal data: admin only, never returned by any public route). */
@Controller('admin/customers')
@UseGuards(AdminGuard)
@SkipThrottle()
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Query() q: ListCustomersQuery) {
    return this.customers.list(q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }

  // POST (not DELETE) because the acting admin re-types their password and proxies may drop DELETE bodies
  @Post(':id/erase')
  @HttpCode(204)
  erase(@Req() req: AdminRequest, @Param('id') id: string, @Body() dto: ConfirmPasswordDto) {
    return this.customers.erase(req.admin.id, id, dto.currentPassword);
  }
}
