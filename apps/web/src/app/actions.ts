'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { site } from '@/content/site';
import { PRODUCTS_TAG, SETTINGS_TAG } from '@/lib/api';

const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const SESSION_COOKIES = ['__Host-abasse_admin', 'abasse_admin'];

/**
 * Called by the panel after saving/deleting so the public site shows the change immediately.
 * Server actions are public HTTP endpoints, so this one requires a valid admin session:
 * otherwise anyone could spam it to keep every page's cache permanently cold (load amplification).
 */
async function hasAdminSession(): Promise<boolean> {
  const jar = await cookies();
  const session = SESSION_COOKIES.map((name) => jar.get(name)).find(Boolean);
  if (!session) return false;
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { cookie: `${session.name}=${encodeURIComponent(session.value)}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * The secret login address (site URL + ADMIN_LOGIN_TOKEN), so an admin can share it with a new teammate.
 * Only returned to a logged-in admin: an outsider calling this server action gets nothing.
 */
export async function getLoginAddress(): Promise<string | null> {
  const token = process.env.ADMIN_LOGIN_TOKEN?.trim();
  if (!token || !(await hasAdminSession())) return null;
  return `${site.url.replace(/\/$/, '')}/${token}`;
}

export async function revalidateCatalog(): Promise<{ ok: boolean }> {
  if (!(await hasAdminSession())) return { ok: false };

  revalidateTag(PRODUCTS_TAG);
  revalidateTag(SETTINGS_TAG);
  revalidatePath('/', 'layout');
  return { ok: true };
}
