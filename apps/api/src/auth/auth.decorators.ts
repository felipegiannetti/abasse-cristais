import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE = 'allowWhenPasswordChangeRequired';

/** Libera a rota mesmo quando o admin ainda precisa trocar a senha inicial. */
export const AllowWhenPasswordChangeRequired = () => SetMetadata(ALLOW_PASSWORD_CHANGE, true);

export interface AdminRequestUser {
  id: string;
  username: string;
  mustChangePassword: boolean;
}
