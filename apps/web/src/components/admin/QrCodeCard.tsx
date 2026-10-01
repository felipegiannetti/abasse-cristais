'use client';

import { motion } from 'motion/react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { site } from '@/content/site';
import { useI18n } from '@/i18n/provider';
import { IconExternal } from './AdminIcons';

/**
 * QR code for a sticker on a physical display (a fair, a market stall): scanning it opens WhatsApp
 * straight to a conversation about this product. The link (/q/<slug>) is a redirect that generates a
 * fresh tracked click on every scan — see apps/web/src/app/q/[slug]/route.ts — so it shows up in
 * Financeiro → Cliques like any other WhatsApp button, with the "código QR impresso" origin.
 */
export function QrCodeCard({ slug }: { slug: string }) {
  const { m } = useI18n();
  const t = m.admin.form.qr;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const url = `${site.url}/q/${slug}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, { width: 220, margin: 1, color: { dark: '#0a1a38', light: '#f5f0e6' } }).catch(() =>
      setError(true),
    );
  }, [url]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-${slug}.png`;
    a.click();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="glass-strong mt-6 rounded-3xl p-6 text-center"
    >
      <h3 className="font-display text-xl text-pearl">{t.title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-pearl/50">{t.help}</p>
      <div className="mt-4 flex justify-center">
        {error ? (
          <p className="py-10 text-sm text-red-300">{t.failed}</p>
        ) : (
          <canvas ref={canvasRef} className="rounded-2xl" />
        )}
      </div>
      <p className="mt-3 break-all font-mono text-xs text-pearl/40">{url}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={download} className="btn btn-ghost btn-sm">
          {t.download}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
          <IconExternal className="h-4 w-4" /> {t.test}
        </a>
      </div>
    </motion.div>
  );
}
