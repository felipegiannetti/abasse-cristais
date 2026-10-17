import { ProductStatus, SaleMode } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// "" vira null para permitir limpar campos opcionais
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const LOCALES = ['en', 'pt', 'es'] as const;

/** The language the public site asks the texts in. */
export class LocaleQuery {
  @IsOptional()
  @IsIn(LOCALES)
  locale?: (typeof LOCALES)[number];
}

export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  /** { en: { name?, description?, category? }, pt: {...}, es: {...} }; validated and cleaned by normalizeTranslations(). */
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description: string;

  /** Centavos. null/omitido = "sob consulta". */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  priceCents?: number | null;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  category: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  weight?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  dimensions?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  origin?: string | null;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  /** UNIT: sold by the piece · WEIGHT: sold by the kilogram (price and cost are then per kg). */
  @IsOptional()
  @IsEnum(SaleMode)
  saleMode?: SaleMode;

  /** Pieces in stock (UNIT products). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stockQuantity?: number;

  /** Grams in stock (WEIGHT products). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  stockGrams?: number;

  /** What one piece / one kg cost the business. Admin only. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  costCents?: number | null;
}

export class UpdateProductDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  priceCents?: number | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  category?: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  weight?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  dimensions?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  origin?: string | null;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  /** UNIT: sold by the piece · WEIGHT: sold by the kilogram (price and cost are then per kg). */
  @IsOptional()
  @IsEnum(SaleMode)
  saleMode?: SaleMode;

  /** Pieces in stock (UNIT products). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stockQuantity?: number;

  /** Grams in stock (WEIGHT products). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  stockGrams?: number;

  /** What one piece / one kg cost the business. Admin only. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  costCents?: number | null;

  /**
   * The `updatedAt` the form read when it opened. When present, the update is refused (409 PRODUCT_CHANGED)
   * if the product changed since — typically a sale that lowered the stock — instead of overwriting it.
   */
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}

export class ListProductsQuery extends LocaleQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  featured?: boolean;

  /** Só usado no painel admin. */
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ReorderImagesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  ids: string[];
}
