import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { detectImage } from './image-type';
import { CreateProductDto, ListProductsQuery, UpdateProductDto } from './products.dto';
import { likeSafe } from '../common/like';

// NEVER select the image bytes here: listings must only carry ids (the bytes are served by GET /images/:id).
const withImages = {
  images: { select: { id: true }, orderBy: { position: 'asc' } },
} satisfies Prisma.ProductInclude;

/** Path of an image as exposed through the site's /api proxy. */
export const imageUrl = (id: string) => `/api/images/${id}`;
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

/**
 * `admin = false` (public API): no cost and no exact stock — only whether the product can be bought.
 * `admin = true`: everything the panel needs.
 */
export function serialize(p: ProductWithImages, admin = false) {
  const inStock = p.saleMode === 'WEIGHT' ? p.stockGrams > 0 : p.stockQuantity > 0;
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
    saleMode: p.saleMode,
    inStock,
    ...(admin ? { stockQuantity: p.stockQuantity, stockGrams: p.stockGrams, costCents: p.costCents } : {}),
    images: p.images.map((i) => ({ id: i.id, url: imageUrl(i.id) })),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------- leitura ----------

  async list(query: ListProductsQuery, opts: { admin: boolean }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 24;

    const where: Prisma.ProductWhereInput = {
      status: opts.admin ? query.status : { in: PUBLIC_STATUSES },
      category: query.category ? { equals: likeSafe(query.category), mode: 'insensitive' } : undefined,
      featured: query.featured ? true : undefined,
      OR: query.q
        ? [
            { name: { contains: likeSafe(query.q), mode: 'insensitive' } },
            { description: { contains: likeSafe(query.q), mode: 'insensitive' } },
            { category: { contains: likeSafe(query.q), mode: 'insensitive' } },
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

    return { items: items.map((p) => serialize(p, opts.admin)), total, page, pageSize };
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

  /** Numbers for the admin dashboard (admin-only route). */
  async stats() {
    // "low stock": available, sold by the piece, down to its last couple of units — the kind of count
    // where a lucky double sale could oversell before the admin notices. Weight-mode products vary too
    // much to pick one sane gram threshold, so they're left out of this heuristic for now.
    const LOW_STOCK_MAX = 2;
    const [total, byStatus, featured, images, categories, recent, value, lowStock] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.product.count({ where: { featured: true } }),
      this.prisma.productImage.count(),
      this.prisma.product.groupBy({
        by: ['category'],
        _count: { _all: true },
        orderBy: { _count: { category: 'desc' } },
        take: 6,
      }),
      this.prisma.product.findMany({ include: withImages, orderBy: { createdAt: 'desc' }, take: 5 }),
      this.prisma.product.aggregate({ where: { status: 'AVAILABLE' }, _sum: { priceCents: true } }),
      this.prisma.product.findMany({
        where: { status: 'AVAILABLE', saleMode: 'UNIT', stockQuantity: { gt: 0, lte: LOW_STOCK_MAX } },
        select: { id: true, slug: true, name: true, stockQuantity: true },
        orderBy: { stockQuantity: 'asc' },
        take: 8,
      }),
    ]);
    const count = (s: ProductStatus) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
    return {
      total,
      byStatus: { AVAILABLE: count('AVAILABLE'), SOLD_OUT: count('SOLD_OUT'), HIDDEN: count('HIDDEN') },
      featured,
      images,
      availableValueCents: value._sum.priceCents ?? 0,
      categories: categories.map((c) => ({ name: c.category, count: c._count._all })),
      recent: recent.map((p) => serialize(p, true)),
      lowStock,
    };
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
    return serialize(p, true);
  }

  // ---------- escrita ----------

  async create(dto: CreateProductDto, actorId?: string) {
    let p: ProductWithImages;
    try {
      p = await this.prisma.product.create({
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
          saleMode: dto.saleMode ?? 'UNIT',
          stockQuantity: dto.stockQuantity ?? (dto.saleMode === 'WEIGHT' ? 0 : 1),
          stockGrams: dto.stockGrams ?? 0,
          costCents: dto.costCents ?? null,
        },
        include: withImages,
      });
    } catch (e) {
      // uniqueSlug() checks availability and this insert happen as two separate steps, so two products
      // created at the same instant with the same name can race for the same slug; the DB's unique
      // constraint is the real guard, surfaced here as a clean error instead of a raw 500.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'SLUG_TAKEN', message: 'A product with a very similar name was just created. Try again.' });
      }
      throw e;
    }
    if (actorId) {
      await this.audit.record({ actorId, action: 'product.create', entityType: 'Product', entityId: p.id, summary: `Criou o produto "${p.name}"` });
    }
    return serialize(p, true);
  }

  async update(id: string, dto: UpdateProductDto, actorId: string) {
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
        saleMode: dto.saleMode,
        stockQuantity: dto.stockQuantity,
        stockGrams: dto.stockGrams,
        costCents: dto.costCents,
      },
      include: withImages,
    });
    await this.audit.record({ actorId, action: 'product.update', entityType: 'Product', entityId: p.id, summary: `Atualizou o produto "${p.name}"` });
    return serialize(p, true);
  }

  /** Copies the catalog fields of an existing product into a new, unpublished draft — useful for a
   * variant (different size/colour) that doesn't need its name/description retyped. Photos and stock
   * are deliberately NOT copied: a variant needs its own photos, and starts with no stock until counted. */
  async duplicate(id: string, actorId: string) {
    const source = await this.prisma.product.findUnique({ where: { id } });
    if (!source) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });

    const copy = await this.create(
      {
        name: `${source.name} (cópia)`,
        description: source.description,
        priceCents: source.priceCents,
        category: source.category,
        weight: source.weight,
        dimensions: source.dimensions,
        origin: source.origin,
        featured: false,
        status: 'HIDDEN', // stays off the site until the admin adds photos and reviews it
        saleMode: source.saleMode,
        stockQuantity: 0,
        stockGrams: 0,
        costCents: source.costCents,
      },
      undefined, // the create() call itself stays unlogged; we log the more specific "duplicate" action below
    );
    await this.audit.record({
      actorId,
      action: 'product.duplicate',
      entityType: 'Product',
      entityId: copy.id,
      summary: `Duplicou o produto "${source.name}" como "${copy.name}"`,
    });
    return copy;
  }

  async remove(id: string, actorId: string) {
    // images are rows of this database and go away with the product (ON DELETE CASCADE)
    const p = await this.prisma.product.findUnique({ where: { id }, select: { name: true } });
    if (!p) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    await this.prisma.product.delete({ where: { id } });
    await this.audit.record({ actorId, action: 'product.delete', entityType: 'Product', entityId: id, summary: `Excluiu o produto "${p.name}"` });
  }

  // ---------- imagens ----------

  async addImage(productId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException({ code: 'IMAGE_REQUIRED', message: 'Send an image in the "file" field.' });
    await this.ensureExists(productId);

    const kind = detectImage(file.buffer);
    if (!kind) throw new UnsupportedMediaTypeException({ code: 'INVALID_IMAGE_FORMAT', message: 'Invalid format. Use JPG, PNG or WebP.' });

    // Lock the product row so concurrent uploads can neither exceed the image limit nor share a position.
    const image = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
      const stats = await tx.productImage.aggregate({
        where: { productId },
        _count: { _all: true },
        _max: { position: true },
      });
      if (stats._count._all >= config.maxImagesPerProduct) {
        throw new BadRequestException({ code: 'IMAGE_LIMIT', message: `Limit of ${config.maxImagesPerProduct} images per product.` });
      }
      return tx.productImage.create({
        data: {
          productId,
          data: new Uint8Array(file.buffer), // raw bytes go to the bytea column
          mimeType: kind.mime,
          size: file.buffer.length,
          position: (stats._max.position ?? -1) + 1,
        },
        select: { id: true },
      });
    });
    return { id: image.id, url: imageUrl(image.id) };
  }

  async removeImage(productId: string, imageId: string) {
    // deleteMany scoped by productId: an image can only be removed through its own product
    const { count } = await this.prisma.productImage.deleteMany({ where: { id: imageId, productId } });
    if (!count) throw new NotFoundException({ code: 'IMAGE_NOT_FOUND', message: 'Image not found.' });
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
