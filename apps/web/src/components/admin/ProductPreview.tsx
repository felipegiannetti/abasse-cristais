'use client';

import { motion } from 'motion/react';
import { formatPrice } from '@/i18n';
import { useI18n } from '@/i18n/provider';
import { productMessage } from '@/lib/whatsapp';
import type { ProductStatus, SaleMode } from '@/lib/types';
import { IconCheck, IconGem } from './AdminIcons';

export interface PreviewData {
  name: string;
  category: string;
  priceCents: number | null;
  status: ProductStatus;
  featured: boolean;
  description: string;
  weight: string;
  dimensions: string;
  origin: string;
  cover?: string;
  photos: number;
  saleMode: SaleMode;
}

/** Live preview: the catalog card, the WhatsApp message the customer will send, and a quality meter. */
export function ProductPreview({ data }: { data: PreviewData }) {
  const { locale, m } = useI18n();
  const t = m.admin.form;
  const sold = data.status === 'SOLD_OUT';

  const checks = [
    { ok: data.name.trim().length >= 3, tip: t.tipName },
    { ok: data.description.trim().length >= 40, tip: t.tipDescription },
    { ok: data.priceCents !== null, tip: t.tipPrice },
    { ok: data.photos >= 3, tip: t.tipPhotos },
    { ok: Boolean(data.weight.trim() || data.dimensions.trim() || data.origin.trim()), tip: t.tipDetails },
  ];
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const verdict = score >= 100 ? t.qualityHigh : score >= 60 ? t.qualityMid : t.qualityLow;
  const R = 26;
  const C = 2 * Math.PI * R;

  const message = productMessage(
    { name: data.name.trim() || t.previewEmpty, slug: 'your-product', priceCents: data.priceCents, saleMode: data.saleMode },
    locale,
    m,
  );

  return (
    <div className="space-y-5">
      <div className="glass-strong gold-border rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl text-pearl">{t.previewTitle}</h3>
          <span className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-gold-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400" /> live
          </span>
        </div>
        <p className="mt-1 text-xs text-pearl/45">{t.previewCard}</p>

        {/* catalog card */}
        <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-navy-900/60 shadow-2xl">
          <div className="relative aspect-[4/5] overflow-hidden bg-navy-900">
            {data.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.cover} alt="" className={`h-full w-full object-cover ${sold ? 'grayscale-[0.6]' : ''}`} />
            ) : (
              <div className="grid h-full w-full place-items-center text-gold-400/40">
                <IconGem className="h-14 w-14" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-950/80 via-transparent to-transparent" />
            {data.category.trim() && (
              <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-navy-950/60 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-gold-300 backdrop-blur">
                {data.category}
              </span>
            )}
            {sold && (
              <span className="absolute right-3 top-3 rounded-full bg-pearl px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-navy-950">
                {m.product.soldOut}
              </span>
            )}
          </div>
          <div className="p-4">
            <p className="font-display text-2xl font-semibold leading-tight text-pearl">{data.name.trim() || t.previewEmpty}</p>
            <p className={`mt-1 text-base font-semibold ${data.priceCents == null ? 'text-pearl/60' : 'text-gold-300'}`}>
              {formatPrice(data.priceCents, locale, m, data.saleMode)}
            </p>
            <div className="btn btn-primary mt-3 w-full !py-2.5 text-sm">{sold ? m.product.askSimilar : m.product.want}</div>
          </div>
        </div>
      </div>

      {/* WhatsApp bubble */}
      <div className="glass-strong rounded-3xl p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pearl/45">{t.previewWhatsapp}</p>
        <motion.div
          key={message}
          initial={{ opacity: 0.5, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mt-3 ml-auto max-w-[92%] whitespace-pre-line break-words rounded-2xl rounded-tr-md bg-gradient-to-br from-[#1f4d43] to-[#173b34] px-4 py-3 text-sm leading-relaxed text-pearl shadow-lg"
        >
          {message}
        </motion.div>
      </div>

      {/* Quality meter */}
      <div className="glass-strong rounded-3xl p-5">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0">
            <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
              <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <motion.circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                stroke="#e0bd7a"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={C}
                animate={{ strokeDashoffset: C * (1 - score / 100) }}
                initial={{ strokeDashoffset: C }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums text-pearl">{score}%</span>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pearl/45">{t.quality}</p>
            <p className="font-display text-xl text-pearl">{verdict}</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {checks.map((c) => (
            <li key={c.tip} className={`flex items-start gap-2.5 text-sm transition-colors ${c.ok ? 'text-gold-300' : 'text-pearl/45'}`}>
              <span className={`mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full ${c.ok ? 'bg-gold-400 text-navy-950' : 'border border-white/20'}`}>
                {c.ok && <IconCheck className="h-3 w-3" strokeWidth={3} />}
              </span>
              {c.tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
