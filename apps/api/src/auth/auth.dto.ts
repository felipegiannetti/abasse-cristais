import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class LoginDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  username: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword: string;

  // 72 = limite de bytes do bcrypt
  @IsString()
  @MinLength(12, { message: 'The new password must be at least 12 characters long.' })
  @MaxLength(72, { message: 'The new password must be at most 72 characters long.' })
  @Matches(/[a-z]/, { message: 'The new password needs at least one lowercase letter.' })
  @Matches(/[A-Z]/, { message: 'The new password needs at least one uppercase letter.' })
  @Matches(/\d/, { message: 'The new password needs at least one number.' })
  newPassword: string;
}
