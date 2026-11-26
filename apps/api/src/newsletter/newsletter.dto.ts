import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { EMAIL_RE, TEMPLATE_LOCALES } from '../settings/settings.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SubscribeDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MaxLength(254)
  @Matches(EMAIL_RE, { message: 'Enter a valid email address.' })
  email: string;

  @IsOptional()
  @IsIn(TEMPLATE_LOCALES)
  locale?: (typeof TEMPLATE_LOCALES)[number];
}

export class SendCampaignDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  subject: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  productIds?: string[];
}
