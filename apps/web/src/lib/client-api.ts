import type { Messages } from '@/i18n';

// Browser-side API client for the admin panel. Every call goes to /api/*, which Next proxies
// to NestJS — same origin, so the httpOnly session cookie is sent automatically.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

interface Options extends Omit<RequestInit, 'body' | 'redirect'> {
  json?: unknown;
  form?: FormData;
  /** On 401 / "change your password" redirect automatically. Turn off for login. */
  autoRedirect?: boolean;
  /** Where to send an expired session (locale-aware home). */
  homePath?: string;
  changePasswordPath?: string;
}

export async function api<T = unknown>(
  path: string,
  { json, form, autoRedirect = true, homePath = '/', changePasswordPath = '/admin/change-password', ...init }: Options = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  let body: BodyInit | undefined;
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  } else if (form) {
    body = form; // the browser sets the multipart boundary
  }

  const res = await fetch(`/api${path}`, { ...init, headers, body, credentials: 'same-origin', cache: 'no-store' });

  if (res.ok) {
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  const data = await res.json().catch(() => null);
  const raw = data?.message ?? data?.error;
  const message = Array.isArray(raw) ? raw.join(' ') : typeof raw === 'string' ? raw : '';
  const code: string | undefined =
    data?.code ??
    (res.status === 413 ? 'TOO_LARGE' : res.status === 429 ? 'RATE_LIMITED' : undefined);

  if (autoRedirect && typeof window !== 'undefined') {
    if (res.status === 401) window.location.assign(homePath); // the login lives at a secret address
    else if (res.status === 403 && code === 'PASSWORD_CHANGE_REQUIRED') window.location.assign(changePasswordPath);
  }
  throw new ApiError(message, res.status, code);
}

/** Localized text for an error: by code, else the server message, else a generic fallback. */
export function errorText(err: unknown, m: Messages, fallback?: string): string {
  if (err instanceof ApiError) {
    const byCode = err.code ? (m.errors as Record<string, string>)[err.code] : undefined;
    if (byCode) return byCode;
    // validation errors come without a code (the API text is English): prefix them in Portuguese
    if (!err.code && err.status === 400 && err.message) return `${m.errors.INVALID_DATA} ${err.message}`;
    return err.message || fallback || m.errors.UNKNOWN;
  }
  return fallback ?? m.errors.UNKNOWN;
}
