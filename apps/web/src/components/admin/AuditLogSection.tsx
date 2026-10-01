'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import type { AuditLogEntry, AuditLogList } from '@/lib/types';
import { IconChart } from './AdminIcons';

const PAGE_SIZE = 15;

const ENTITY_LABEL: Record<string, string> = {
  Product: 'Produto',
  Sale: 'Venda',
  Customer: 'Cliente',
  Settings: 'Configurações',
  AdminUser: 'Equipe',
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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

  useEffect(() => load(1, entityType, false), [entityType, load]);

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
        <>
          {items.length === 0 ? (
            <p className="mt-6 text-sm text-pearl/45">{t.empty}</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.06]">
              {items.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-white/[0.015] px-4 py-3 text-sm">
                  <span className="text-pearl/85">{e.summary}</span>
                  <span className="whitespace-nowrap text-xs text-pearl/40">
                    {e.actorUsername} · {fmtWhen(e.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {total > items.length && (
            <div className="mt-4 text-center">
              <button type="button" className="btn btn-ghost btn-sm" disabled={loading} onClick={() => load(page + 1, entityType, true)}>
                {loading ? t.loading : t.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
