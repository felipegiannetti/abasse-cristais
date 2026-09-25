'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { PRODUCTS_TAG } from '@/lib/api';

const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const SESSION_COOKIES = ['__Host-abasse_admin', 'abasse_admin'];

/**
 * Called by the panel after saving/deleting so the public site shows the change immediately.
 * Server actions are public HTTP endpoints, so this one requires a valid admin session:
 * otherwise anyone could spam it to keep every page's cache permanently cold (load amplification).
 */
export async function revalidateCatalog(): Promise<{ ok: boolean }> {
  const jar = await cookies();
  const session = SESSION_COOKIES.map((name) => jar.get(name)).find(Boolean);
  if (!session) return { ok: false };

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { cookie: `${session.name}=${encodeURIComponent(session.value)}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false };
  } catch {
    return { ok: false };
  }

  revalidateTag(PRODUCTS_TAG);
  revalidatePath('/', 'layout');
  return { ok: true };
}
