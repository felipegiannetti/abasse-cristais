import { randomBytes } from 'crypto';

// Development convenience: load apps/api/.env (never overrides real environment variables).
// In production the platform (Vercel) injects the variables, so no file is read.
if (process.env.NODE_ENV !== 'production') {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file: fine
  }
}

const isProd = process.env.NODE_ENV === 'production';

/** Placeholders copied from .env.example must never be accepted as real secrets. */
const PLACEHOLDER = /troque|change[-_ ]?me|example|placeholder|your[-_ ]?secret|dev-only/i;

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (isProd) {
    if (!secret || secret.length < 32 || PLACEHOLDER.test(secret)) {
      throw new Error('JWT_SECRET is required in production: at least 32 random characters, not a placeholder.');
    }
    return secret;
  }
  if (secret && secret.length >= 16 && !PLACEHOLDER.test(secret)) return secret;
  // Development without a real secret: use a random per-process key (sessions reset on restart)
  // instead of a hardcoded value that anyone could use to forge admin sessions.
  console.warn('[config] JWT_SECRET not set — using a temporary random secret (sessions reset on restart).');
  return randomBytes(48).toString('base64url');
}

/**
 * Secret path segment of the admin login page (same value as the web app's ADMIN_LOGIN_TOKEN).
 * The login endpoint only answers requests that present it, so the API cannot be brute-forced
 * without knowing the secret address. Unset/invalid = login disabled (fails closed).
 */
function loginToken(): string {
  const t = process.env.ADMIN_LOGIN_TOKEN?.trim() ?? '';
  if (/^[A-Za-z0-9_-]{16,128}$/.test(t) && !PLACEHOLDER.test(t)) return t;
  console.warn('[config] ADMIN_LOGIN_TOKEN missing or invalid — admin login is DISABLED.');
  return '';
}

export const config = {
  isProd,
  jwtSecret: jwtSecret(),
  jwtIssuer: 'abasse-api',
  jwtAudience: 'abasse-admin',
  loginToken: loginToken(),
  sessionDays: 60, // persistent login on the same computer
  cookieName: isProd ? '__Host-abasse_admin' : 'abasse_admin',
  webOrigins: (process.env.WEB_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  maxImageBytes: 4 * 1024 * 1024, // Vercel Functions request-body limit is ~4.5 MB
  maxImagesPerProduct: 10,
  maxFailedLogins: 5,
  lockMinutes: 15,
  // Number of trusted reverse-proxy hops in front of the API (Vercel edge = 1). Never `true`:
  // that would trust a client-supplied X-Forwarded-For and let attackers dodge rate limits.
  trustProxyHops: Number.parseInt(process.env.TRUST_PROXY_HOPS ?? (isProd ? '1' : '0'), 10) || 0,
};
