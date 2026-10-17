'use client';

import { useEffect, useState } from 'react';
import { fxNote } from '@/i18n';
import { useI18n } from '@/i18n/provider';
import type { FxInfo } from '@/lib/types';

const POLL_MS = 5 * 60_000;
const fmtRate = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/**
 * Small "US$ 1 = R$ 5,08" monitor for the Portuguese site: the rate prices are converted with, an arrow for
 * the last move, and the source/date on hover. It re-reads the rate every few minutes while the page is open.
 */
export function FxTicker({ className = '' }: { className?: string }) {
  const { m, fx: initial } = useI18n();
  const [fx, setFx] = useState<FxInfo | null>(initial);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/fx/usd-brl')
        .then((r) => (r.ok ? (r.json() as Promise<FxInfo>) : null))
        .then((d) => {
          if (alive && d && typeof d.rate === 'number' && d.rate > 1 && d.rate < 20) setFx(d);
        })
        .catch(() => {});
    };
    const id = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  if (!fx) return null;
  const move = fx.previousRate ? Math.sign(fx.rate - fx.previousRate) : 0;
  const when = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(fx.asOf));

  return (
    <span
      className={`items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-xs ${className}`}
      title={`${fxNote(fx, m)} Atualizada em ${when} (Brasília).${fx.stale ? ' Atenção: cotação antiga.' : ''}`}
      aria-label={`Dólar hoje: R$ ${fmtRate(fx.rate)}`}
    >
      <span className="text-pearl/50">US$ 1</span>
      <span className="text-pearl/40">=</span>
      <span className="font-semibold tabular-nums text-pearl">R$ {fmtRate(fx.rate)}</span>
      {move !== 0 && (
        <span aria-hidden="true" className={move > 0 ? 'text-emerald-300' : 'text-red-300'}>
          {move > 0 ? '▲' : '▼'}
        </span>
      )}
      {fx.stale && <span className="text-amber-300" title="Cotação antiga">!</span>}
    </span>
  );
}
