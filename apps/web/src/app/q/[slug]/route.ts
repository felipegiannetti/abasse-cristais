import { NextResponse, type NextRequest } from 'next/server';
import { fmt } from '@/i18n/config';
import { fetchContact, fetchFx, fetchMessages, fetchProduct } from '@/lib/api';
import { makeRef } from '@/lib/ref';
import { productMessage, whatsappUrl } from '@/lib/whatsapp';

const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');

/**
 * Short, print-friendly redirect for a QR code sticker on a physical display (a fair, a market stall):
 * scanning it opens WhatsApp straight to a conversation about THIS product. Always in Portuguese — a
 * printed sticker can't know the scanner's language preference, and this is meant for local, in-person
 * sales. Lives outside the [locale] tree on purpose (see middleware.ts) so the printed URL stays short
 * and never changes even if the routing above it does.
 *
 * Reuses the exact same click-tracking table/flow as every on-site WhatsApp button (a fresh ref per
 * scan, source "QR_CODE"), so scans show up in Financeiro → Cliques next to the others.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await fetchProduct(slug);
  if (!product) return NextResponse.redirect(new URL('/pt/products', _req.url));

  const [contact, m, fx] = await Promise.all([fetchContact(), fetchMessages('pt'), fetchFx()]); // the QR message is Portuguese: reais
  const ref = makeRef();
  const tail = fmt(m.whatsapp.tail, { ref, origin: m.whatsapp.origins.QR_CODE });
  const message = `${productMessage(product, 'pt', m, fx)}\n\n${tail}`;

  try {
    await fetch(`${API_URL}/track/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref, source: 'QR_CODE', path: `/products/${slug}`, productSlug: slug, locale: 'pt' }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // tracking must never stop the redirect from working
  }

  return NextResponse.redirect(whatsappUrl(message, contact.whatsapp));
}
