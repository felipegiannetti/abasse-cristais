'use client';

import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import type { AuditLogEntry, AuditLogList } from '@/lib/types';
import { IconChart } from './AdminIcons';

const PAGE_SIZE = 50;

const ENTITY_LABEL: Record<string, string> = {
  Product: 'Produto',
  Sale: 'Venda',
  Customer: 'Cliente',
  Settings: 'Configurações',
  AdminUser: 'Equipe',
};

const ENTITY_COLOR: Record<string, string> = {
  Product: 'text-sky',
  Sale: 'text-emerald-300',
  Customer: 'text-violet-300',
  Settings: 'text-amber-300',
  AdminUser: 'text-rose-300',
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** "Quem mexeu em quê": a chronological feed of admin-made changes to products, sales, customers,
 * settings and the team itself. Read-only — nothing here can be edited or undone from this screen. */
export function AuditLogSection() {
  const { m, href } = useI18n();
  const t = m.admin.audit;
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };

  const [items, setItems] = useState<AuditLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback((pageToLoad: number, type: string, append: boolean) => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(pageToLoad), pageSize: String(PAGE_SIZE) });
    if (type) qs.set('entityType', type);
    api<AuditLogList>(`/admin/audit-log?${qs}`, nav)
      .then((d) => {
        setItems((cur) => (append ? [...(cur ?? []), ...d.items] : d.items));
        setTotal(d.total);
        setPage(pageToLoad);
        setError('');
      })
      .catch((e) => setError(errorText(e, m, t.loadFailed)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    box.current?.scrollTo({ top: 0 });
    load(1, entityType, false);
  }, [entityType, load]);

  // Console-style infinite scroll: when the reader gets near the bottom of the box, fetch the next batch.
  const onScroll = (ev: UIEvent<HTMLDivElement>) => {
    const el = ev.currentTarget;
    if (!loading && items && items.length < total && el.scrollHeight - el.scrollTop - el.clientHeight < 80) load(page + 1, entityType, true);
  };

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl text-pearl">
            <IconChart className="h-5 w-5 text-gold-300" /> {t.title}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-pearl/55">{t.subtitle}</p>
        </div>
        <select
          aria-label={t.filterLabel}
          className="field !w-auto !py-2 text-sm"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        >
          <option value="">{t.filterAll}</option>
          {Object.entries(ENTITY_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p role="alert" className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">{error}</p>}

      {loading && !items && (
        <div className="mt-4 space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-12" />
          ))}
        </div>
      )}

      {items && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#060b17] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
          {/* barra de título estilo terminal */}
          <div className="flex items-center gap-2 border-b border-white/[0.07] bg-white/[0.03] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-2 font-mono text-xs text-pearl/45">atividade.log</span>
            <span className="ml-auto font-mono text-xs text-pearl/35">{items.length} de {total}</span>
          </div>
          <div
            ref={box}
            onScroll={onScroll}
            tabIndex={0}
            role="log"
            aria-label={t.title}
            className="max-h-[26rem] overflow-y-auto px-4 py-3 font-mono text-[0.8rem] leading-relaxed focus:outline-none focus-visible:ring-1 focus-visible:ring-gold-400/50"
          >
            {items.length === 0 ? (
              <p className="text-pearl/45">$ {t.empty}</p>
            ) : (
              items.map((e) => (
                <div key={e.id} className="flex gap-3 rounded px-1 py-0.5 hover:bg-white/[0.04]">
                  <span className="shrink-0 text-pearl/35">{fmtWhen(e.createdAt)}</span>
                  <span className={`w-24 shrink-0 truncate ${ENTITY_COLOR[e.entityType] ?? 'text-pearl/60'}`}>{ENTITY_LABEL[e.entityType] ?? e.entityType}</span>
                  <span className="w-20 shrink-0 truncate text-gold-300/80">{e.actorUsername}</span>
                  <span className="min-w-0 break-words text-pearl/85">{e.summary}</span>
                </div>
              ))
            )}
            {loading && <p className="mt-1 text-pearl/45">{t.loading}<span className="ml-0.5 inline-block animate-pulse">▍</span></p>}
            {!loading && items.length > 0 && items.length >= total && <p className="mt-1 text-pearl/30">— fim do histórico —</p>}
          </div>
        </div>
      )}
    </div>
  );
}
