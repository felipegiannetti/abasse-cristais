import { SaleStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export const PAYMENT_METHODS = ['PIX', 'CREDIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'WISE', 'STRIPE', 'CASH', 'OTHER'] as const;
export const MAX_MONEY_CENTS = 100_000_000; // R$ 1,000,000 per line: keeps every product of price × grams below 2^53

/** Postal address. The shop ships worldwide: country is an ISO 3166-1 alpha-2 code. */
export class AddressDto {
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  recipient?: string | null;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  line1: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  line2?: string | null;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @Transform(upper)
  @Matches(/^[A-Z]{2}$/, { message: 'Country must be an ISO 3166-1 alpha-2 code (e.g. BR, US, ES).' })
  country: string;
}

export class CustomerFieldsDto {
  @Transform(emptyToNull)
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @Matches(/^[+\d\s().-]{5,30}$/, { message: 'Invalid phone number.' })
  phone?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  addressLine1?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  addressLine2?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @Transform((p) => emptyToNull({ value: upper(p) }))
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, { message: 'Country must be an ISO 3166-1 alpha-2 code (e.g. BR, US, ES).' })
  country?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class CreateCustomerDto extends CustomerFieldsDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;
}

export class UpdateCustomerDto extends CustomerFieldsDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;
}

export class SaleItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  productId: string;

  /** Pieces (UNIT products) or grams (WEIGHT products). */
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity: number;

  /** Optional negotiated price per piece / per kg; defaults to the product's current price. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_CENTS)
  unitPriceCents?: number;
}

export class CreateSaleDto {
  @IsOptional()
  @IsISO8601()
  soldAt?: string;

  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  customer?: CreateCustomerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  shipTo?: AddressDto;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  shippingMethod?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_CENTS)
  shippingCostCents?: number;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  trackingCode?: string | null;

  @IsIn(PAYMENT_METHODS)
  paymentMethod: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_CENTS)
  discountCents?: number;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  /** WhatsApp reference code (Ref: XXXXXX) that led to this sale. */
  @Transform((p) => emptyToNull({ value: upper(p) }))
  @IsOptional()
  @Matches(/^[A-Z2-9]{6}$/, { message: 'Invalid reference code.' })
  clickRef?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];
}

export class UpdateSaleDto {
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  trackingCode?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  shippingMethod?: string | null;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: (typeof PAYMENT_METHODS)[number];

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class ListSalesQuery {
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

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

export class ListCustomersQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  q?: string;

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

export class ConfirmPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword: string;
}
