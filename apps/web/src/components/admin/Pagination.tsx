'use client';

/** Numbered page buttons with "…" gaps: 1 … 4 5 [6] 7 8 … 20. */
function pageList(current: number, last: number): (number | 'gap-l' | 'gap-r')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages = new Set([1, last, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= last - 2) [last - 3, last - 2, last - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: (number | 'gap-l' | 'gap-r')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(i < sorted.length / 2 ? 'gap-l' : 'gap-r');
    out.push(p);
  });
  return out;
}

const btn =
  'grid h-10 min-w-10 place-items-center rounded-full border px-3 text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40';

/** Page navigation for the admin lists: "Mostrando 16–30 de 62", previous/next and numbered pages. Renders
 * nothing when everything fits on one page. */
export function Pagination({
  page,
  total,
  pageSize,
  onChange,
  loading = false,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  loading?: boolean;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const go = (p: number) => {
    if (p < 1 || p > last || p === page || loading) return;
    onChange(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav aria-label="Paginação" className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
      <p className="text-sm text-pearl/50" aria-live="polite">
        Mostrando <span className="font-semibold text-pearl/80">{from}–{to}</span> de <span className="font-semibold text-pearl/80">{total}</span>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button type="button" className={`${btn} border-white/10 text-pearl/70 hover:border-gold-400/50 hover:text-gold-300`} disabled={page <= 1 || loading} onClick={() => go(page - 1)} aria-label="Página anterior">
          ← Anterior
        </button>
        {pageList(page, last).map((p) =>
          typeof p === 'string' ? (
            <span key={p} aria-hidden="true" className="px-1 text-pearl/35">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={`Página ${p}`}
              aria-current={p === page ? 'page' : undefined}
              disabled={loading && p !== page}
              onClick={() => go(p)}
              className={`${btn} ${p === page ? 'border-gold-400 bg-gradient-to-r from-gold-300 to-gold-500 text-navy-950' : 'border-white/10 text-pearl/70 hover:border-gold-400/50 hover:text-gold-300'}`}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className={`${btn} border-white/10 text-pearl/70 hover:border-gold-400/50 hover:text-gold-300`} disabled={page >= last || loading} onClick={() => go(page + 1)} aria-label="Próxima página">
          Próxima →
        </button>
      </div>
    </nav>
  );
}
