import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, detectImage } from '../storage/storage.service';
import { CreateProductDto, ListProductsQuery, UpdateProductDto } from './products.dto';

const withImages = { images: { orderBy: { position: 'asc' } } } satisfies Prisma.ProductInclude;
type ProductWithImages = Prisma.ProductGetPayload<{ include: typeof withImages }>;

const PUBLIC_STATUSES: ProductStatus[] = ['AVAILABLE', 'SOLD_OUT'];

function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'cristal'
  );
}

export function serialize(p: ProductWithImages) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    category: p.category,
    weight: p.weight,
    dimensions: p.dimensions,
    origin: p.origin,
    featured: p.featured,
    status: p.status,
    images: p.images.map((i) => ({ id: i.id, url: i.url })),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ---------- leitura ----------

  async list(query: ListProductsQuery, opts: { admin: boolean }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 24;

    const where: Prisma.ProductWhereInput = {
      status: opts.admin ? query.status : { in: PUBLIC_STATUSES },
      category: query.category ? { equals: query.category, mode: 'insensitive' } : undefined,
      featured: query.featured ? true : undefined,
      OR: query.q
        ? [
            { name: { contains: query.q, mode: 'insensitive' } },
            { description: { contains: query.q, mode: 'insensitive' } },
            { category: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: withImages,
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items: items.map(serialize), total, page, pageSize };
  }

  async categories() {
    const rows = await this.prisma.product.groupBy({
      by: ['category'],
      where: { status: { in: PUBLIC_STATUSES } },
      _count: { _all: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => ({ name: r.category, count: r._count._all }));
  }

  async allCategoryNames() {
    const rows = await this.prisma.product.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  }

  async findBySlug(slug: string) {
    const p = await this.prisma.product.findFirst({
      where: { slug, status: { in: PUBLIC_STATUSES } },
      include: withImages,
    });
    if (!p) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    return serialize(p);
  }

  async findById(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, include: withImages });
    if (!p) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    return serialize(p);
  }

  // ---------- escrita ----------

  async create(dto: CreateProductDto) {
    const p = await this.prisma.product.create({
      data: {
        slug: await this.uniqueSlug(dto.name),
        name: dto.name,
        description: dto.description,
        priceCents: dto.priceCents ?? null,
        category: dto.category,
        weight: dto.weight ?? null,
        dimensions: dto.dimensions ?? null,
        origin: dto.origin ?? null,
        featured: dto.featured ?? false,
        status: dto.status ?? 'AVAILABLE',
      },
      include: withImages,
    });
    return serialize(p);
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.ensureExists(id);
    // O slug é mantido de propósito: links já compartilhados no WhatsApp não podem quebrar.
    const p = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        priceCents: dto.priceCents,
        category: dto.category,
        weight: dto.weight,
        dimensions: dto.dimensions,
        origin: dto.origin,
        featured: dto.featured,
        status: dto.status,
      },
      include: withImages,
    });
    return serialize(p);
  }

  async remove(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, include: { images: true } });
    if (!p) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    await this.prisma.product.delete({ where: { id } });
    await Promise.all(p.images.map((i) => this.storage.remove(i.url)));
  }

  // ---------- imagens ----------

  async addImage(productId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException({ code: 'IMAGE_REQUIRED', message: 'Send an image in the "file" field.' });
    await this.ensureExists(productId);

    const kind = detectImage(file.buffer);
    if (!kind) throw new UnsupportedMediaTypeException({ code: 'INVALID_IMAGE_FORMAT', message: 'Invalid format. Use JPG, PNG or WebP.' });

    const count = await this.prisma.productImage.count({ where: { productId } });
    if (count >= config.maxImagesPerProduct) {
      throw new BadRequestException({ code: 'IMAGE_LIMIT', message: `Limit of ${config.maxImagesPerProduct} images per product.` });
    }

    const url = await this.storage.save(file.buffer, kind);
    const last = await this.prisma.productImage.aggregate({
      where: { productId },
      _max: { position: true },
    });
    const image = await this.prisma.productImage.create({
      data: { productId, url, position: (last._max.position ?? -1) + 1 },
    });
    return { id: image.id, url: image.url };
  }

  async removeImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) throw new NotFoundException({ code: 'IMAGE_NOT_FOUND', message: 'Image not found.' });
    await this.prisma.productImage.delete({ where: { id: image.id } });
    await this.storage.remove(image.url);
  }

  async reorderImages(productId: string, ids: string[]) {
    const existing = await this.prisma.productImage.findMany({
      where: { productId },
      select: { id: true },
    });
    const known = new Set(existing.map((i) => i.id));
    if (ids.length !== known.size || !ids.every((id) => known.has(id))) {
      throw new BadRequestException({ code: 'IMAGE_ORDER_MISMATCH', message: 'The image list does not match the product images.' });
    }
    await this.prisma.$transaction(
      ids.map((id, position) => this.prisma.productImage.update({ where: { id }, data: { position } })),
    );
    return this.findById(productId);
  }

  // ---------- helpers ----------

  private async ensureExists(id: string) {
    const exists = await this.prisma.product.count({ where: { id } });
    if (!exists) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    for (let n = 2; await this.prisma.product.count({ where: { slug: candidate } }); n++) {
      candidate = `${base}-${n}`;
    }
    return candidate;
  }
}
