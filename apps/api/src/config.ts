const isProd = process.env.NODE_ENV === 'production';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (isProd && (!secret || secret.length < 32)) {
    throw new Error('JWT_SECRET is required in production (minimum 32 characters).');
  }
  return secret || 'dev-only-secret-do-not-use-in-production';
}

export const config = {
  isProd,
  jwtSecret: jwtSecret(),
  sessionDays: 60, // login persistente no mesmo computador
  cookieName: isProd ? '__Host-abasse_admin' : 'abasse_admin',
  webOrigins: (process.env.WEB_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  blobToken: process.env.BLOB_READ_WRITE_TOKEN || '',
  maxImageBytes: 4 * 1024 * 1024, // limite de corpo da Vercel Functions é ~4,5 MB
  maxImagesPerProduct: 10,
  maxFailedLogins: 5,
  lockMinutes: 15,
};
