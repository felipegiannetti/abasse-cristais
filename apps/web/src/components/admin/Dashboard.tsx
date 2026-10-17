'use client';

import { motion, type Variants } from 'motion/react';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { formatPrice, plural } from '@/i18n';
import { useI18n } from '@/i18n/provider';
import { useApiResource } from '@/lib/useApiResource';
import type { ProductStatus, Stats } from '@/lib/types';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCart,
  IconChart,
  IconExternal,
  IconGem,
  IconImage,
  IconPlus,
  IconSettings,
  IconSparkle,
  IconStar,
} from './AdminIcons';
import { useMe } from './AdminShell';

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const STATUS_COLORS: Record<ProductStatus, string> = {
  AVAILABLE: '#e0bd7a',
  SOLD_OUT: '#6e9be0',
  HIDDEN: '#7d8aa6',
};

function greeting(m: ReturnType<typeof useI18n>['m']) {
  const h = new Date().getHours();
  return h < 12 ? m.admin.shell.greetMorning : h < 18 ? m.admin.shell.greetAfternoon : m.admin.shell.greetEvening;
}

function StatCard({ icon, label, children, accent }: { icon: ReactNode; label: string; children: ReactNode; accent?: boolean }) {
  return (
    <motion.div variants={item}>
      <div className={`relative glass-strong h-full rounded-3xl p-5 ${accent ? 'gold-border' : ''}`}>
        <div className="flex items-center justify-between">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gold-400/15 text-gold-300">{icon}</span>
          </div>
        <p className="mt-5 font-display text-3xl font-semibold leading-none tabular-nums text-pearl">{children}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-pearl/45">{label}</p>
      </div>
    </motion.div>
  );
}

function Donut({ values, total }: { values: Record<ProductStatus, number>; total: number }) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const order: ProductStatus[] = ['AVAILABLE', 'SOLD_OUT', 'HIDDEN'];
  let offset = 0;
  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
        {total > 0 &&
          order.map((s, i) => {
            const len = (values[s] / total) * C;
            const el = (
              <motion.circle
                key={s}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={STATUS_COLORS[s]}
                strokeWidth="14"
                strokeLinecap="butt"
                strokeDasharray={`${Math.max(len - 2, 0)} ${C}`}
                initial={{ strokeDashoffset: -offset + C }}
                animate={{ strokeDashoffset: -offset }}
                transition={{ duration: 1.1, delay: 0.2 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-3xl font-semibold tabular-nums text-pearl">
            {total.toLocaleString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { locale, m, href } = useI18n();
  const me = useMe();
  const t = m.admin.dash;
  const { data: stats, error } = useApiResource<Stats>('/admin/products/stats', t.loadFailed);

  if (error) {
    return <p role="alert" className="glass rounded-3xl px-6 py-5 text-sm text-red-200">{error}</p>;
  }
  if (!stats) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="skeleton h-28" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-40" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="skeleton h-72" />
          <div className="skeleton h-72" />
        </div>
      </div>
    );
  }

  const maxCat = Math.max(1, ...stats.categories.map((c) => c.count));
  const legend: { key: ProductStatus; label: string }[] = [
    { key: 'AVAILABLE', label: t.available },
    { key: 'SOLD_OUT', label: t.soldOut },
    { key: 'HIDDEN', label: t.hidden },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Hero */}
      <motion.section variants={item} className="glass-strong relative overflow-hidden rounded-3xl p-6 sm:p-7">
        <p className="eyebrow">{greeting(m)}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-pearl sm:text-3xl">{me?.username}</h1>
        <p className="mt-2 max-w-xl text-pearl/60">{t.subtitle}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={href('/admin/products/new')} className="btn btn-primary">
            <IconPlus className="h-4 w-4" /> {t.quickAdd}
          </Link>
          <Link href={href('/admin/sales/new')} className="btn btn-ghost">
            <IconCart className="h-4 w-4" /> Registrar venda
          </Link>
          <Link href={href('/admin/products')} className="btn btn-ghost">
            {t.quickManage} <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.section>

      {/* Low stock warning */}
      {stats.lowStock.length > 0 && (
        <motion.section variants={item} className="glass-strong rounded-3xl border border-amber-400/25 bg-amber-400/[0.06] p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-400/15 text-amber-300">
              <IconAlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl text-pearl">{t.lowStockTitle}</h2>
              <p className="mt-1 text-sm text-pearl/60">{plural(stats.lowStock.length, t.lowStockOne, t.lowStockMany)}</p>
              <ul className="mt-3 space-y-2">
                {stats.lowStock.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={href(`/admin/products/${p.id}`)}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-white/5"
                    >
                      <span className="truncate text-pearl/85">{p.name}</span>
                      <span className="shrink-0 font-semibold text-amber-300">{plural(p.stockQuantity, t.lowStockUnitOne, t.lowStockUnitMany)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>
      )}

      {/* Numbers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard accent icon={<IconGem />} label={t.total}>
          {stats.total.toLocaleString('pt-BR')}
        </StatCard>
        <StatCard icon={<IconSparkle />} label={t.available}>
          {stats.byStatus.AVAILABLE.toLocaleString('pt-BR')}
        </StatCard>
        <StatCard icon={<IconStar />} label={t.featured}>
          {stats.featured.toLocaleString('pt-BR')}
        </StatCard>
        <StatCard icon={<IconImage />} label={t.photos}>
          {stats.images.toLocaleString('pt-BR')}
        </StatCard>
      </div>

      <motion.div variants={item}>
        <div className="relative glass-strong flex flex-wrap items-center justify-between gap-4 rounded-3xl px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pearl/45">{t.value}</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-gold-300">
              {formatPrice(Math.round(stats.availableValueCents), locale, m)}
            </p>
          </div>
          <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-white/[0.06] sm:max-w-md">
            <motion.div
              className="h-full rounded-full bg-gold-400"
              initial={{ width: 0 }}
              animate={{ width: `${stats.total ? (stats.byStatus.AVAILABLE / stats.total) * 100 : 0}%` }}
              transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status donut */}
        <motion.section variants={item} className="glass-strong rounded-3xl p-6">
          <h2 className="font-display text-2xl text-pearl">{t.statusTitle}</h2>
          <div className="mt-4 grid items-center gap-6 sm:grid-cols-[auto_1fr]">
            <Donut values={stats.byStatus} total={stats.total} />
            <ul className="space-y-3">
              {legend.map((l) => (
                <li key={l.key} className="flex items-center gap-3 text-sm">
                  <span className="h-3 w-3 rounded-full" style={{ background: STATUS_COLORS[l.key] }} />
                  <span className="flex-1 text-pearl/70">{l.label}</span>
                  <span className="font-semibold tabular-nums text-pearl">{stats.byStatus[l.key]}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.section>

        {/* Categories */}
        <motion.section variants={item} className="glass-strong rounded-3xl p-6">
          <h2 className="font-display text-2xl text-pearl">{t.categoriesTitle}</h2>
          {stats.categories.length === 0 ? (
            <p className="mt-6 text-sm text-pearl/45">{t.noCategories}</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {stats.categories.map((c, i) => (
                <li key={c.name}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-pearl/80">{c.name}</span>
                    <span className="tabular-nums text-pearl/50">
                      {c.count} {t.pieces}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      className="h-full rounded-full bg-gold-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${(c.count / maxCat) * 100}%` }}
                      transition={{ duration: 0.9, delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Recent */}
        <motion.section variants={item} className="glass-strong rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-pearl">{t.recentTitle}</h2>
            <Link href={href('/admin/products')} className="text-sm text-gold-300 hover:text-gold-400">
              {t.viewAll} →
            </Link>
          </div>
          {stats.recent.length === 0 ? (
            <div className="grid place-items-center py-10 text-center">
              <IconGem className="h-10 w-10 text-gold-400/70" />
              <p className="mt-3 font-display text-2xl text-pearl">{t.emptyTitle}</p>
              <p className="mt-1 max-w-xs text-sm text-pearl/50">{t.emptyText}</p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-white/[0.06]">
              {stats.recent.map((p) => (
                <li key={p.id}>
                  <Link
                    href={href(`/admin/products/${p.id}`)}
                    className="group flex items-center gap-4 rounded-2xl px-2 py-3 transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-navy-900">
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0].url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-gold-400/40">
                          <IconGem />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-xl text-pearl group-hover:text-gold-300">{p.name}</span>
                      <span className="block truncate text-xs text-pearl/45">{p.category}</span>
                    </span>
                    <span className="text-sm font-semibold text-gold-300">{formatPrice(p.priceCents, locale, m)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        {/* Quick actions */}
        <motion.section variants={item} className="glass-strong rounded-3xl p-6">
          <h2 className="font-display text-2xl text-pearl">{t.quickTitle}</h2>
          <div className="mt-4 grid gap-3">
            {[
              { href: href('/admin/products/new'), icon: <IconPlus />, label: t.quickAdd, external: false },
              { href: href('/admin/sales/new'), icon: <IconCart />, label: 'Registrar venda', external: false },
              { href: href('/admin/finance'), icon: <IconChart />, label: 'Financeiro', external: false },
              { href: href('/admin/settings'), icon: <IconSettings />, label: m.admin.shell.settings, external: false },
              { href: href('/'), icon: <IconExternal />, label: t.quickSite, external: true },
            ].map((a) => (
              <Link
                key={a.label}
                href={a.href}
                target={a.external ? '_blank' : undefined}
                className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm font-medium text-pearl/85 transition-all hover:-translate-y-0.5 hover:border-gold-400/40 hover:bg-gold-400/[0.07]"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-400/15 text-gold-300">{a.icon}</span>
                <span className="flex-1">{a.label}</span>
                <IconArrowRight className="h-4 w-4 text-pearl/30 transition-transform group-hover:translate-x-1 group-hover:text-gold-300" />
              </Link>
            ))}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
