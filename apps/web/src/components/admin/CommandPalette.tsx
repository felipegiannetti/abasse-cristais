'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@/i18n/provider';
import { api } from '@/lib/client-api';
import type { ProductList } from '@/lib/types';
import {
  IconCart,
  IconChart,
  IconContact,
  IconDashboard,
  IconExternal,
  IconGem,
  IconKey,
  IconLogout,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUsers,
} from './AdminIcons';

interface Command {
  id: string;
  group: 'navigate' | 'actions' | 'products';
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

/** Ctrl/⌘ + K launcher: jump anywhere, run actions, or find a product by name. */
export function CommandPalette({ open, onClose, onLogout }: { open: boolean; onClose: () => void; onLogout: () => void }) {
  const { m, href } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ id: string; name: string; category: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const go = (path: string) => () => {
    onClose();
    router.push(href(path));
  };

  const commands = useMemo<Command[]>(() => {
    const ic = 'h-4.5 w-4.5';
    const base: Command[] = [
      { id: 'dash', group: 'navigate', label: m.admin.shell.dashboard, icon: <IconDashboard className={ic} />, run: go('/admin') },
      { id: 'prod', group: 'navigate', label: m.admin.nav.products, icon: <IconGem className={ic} />, run: go('/admin/products') },
      { id: 'sales', group: 'navigate', label: 'Vendas', icon: <IconCart className={ic} />, run: go('/admin/sales') },
      { id: 'cust', group: 'navigate', label: 'Clientes', icon: <IconContact className={ic} />, run: go('/admin/customers') },
      { id: 'fin', group: 'navigate', label: 'Financeiro', icon: <IconChart className={ic} />, run: go('/admin/finance') },
      { id: 'team', group: 'navigate', label: m.admin.shell.team, icon: <IconUsers className={ic} />, run: go('/admin/team') },
      { id: 'set', group: 'navigate', label: m.admin.shell.settings, icon: <IconSettings className={ic} />, run: go('/admin/settings') },
      { id: 'pwd', group: 'navigate', label: m.admin.nav.password, icon: <IconKey className={ic} />, run: go('/admin/change-password') },
      { id: 'newsale', group: 'actions', label: 'Registrar venda', icon: <IconCart className={ic} />, run: go('/admin/sales/new') },
      { id: 'new', group: 'actions', label: m.admin.shell.newProduct, icon: <IconPlus className={ic} />, run: go('/admin/products/new') },
      {
        id: 'site',
        group: 'actions',
        label: m.admin.nav.viewSite,
        icon: <IconExternal className={ic} />,
        run: () => {
          onClose();
          window.open(href('/'), '_blank', 'noopener');
        },
      },
      {
        id: 'out',
        group: 'actions',
        label: m.admin.nav.logout,
        icon: <IconLogout className={ic} />,
        run: () => {
          onClose();
          onLogout();
        },
      },
    ];
    const q = query.trim().toLowerCase();
    const filtered = q ? base.filter((c) => c.label.toLowerCase().includes(q)) : base;
    const products: Command[] = found.map((p) => ({
      id: `p-${p.id}`,
      group: 'products',
      label: p.name,
      hint: p.category,
      icon: <IconGem className={ic} />,
      run: go(`/admin/products/${p.id}`),
    }));
    return [...filtered, ...products];
    // go() only closes over stable values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, query, found, href]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setFound([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // live product search
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setFound([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api<ProductList>(`/admin/products?pageSize=5&q=${encodeURIComponent(q)}`, {
        homePath: href('/'),
        changePasswordPath: href('/admin/change-password'),
      })
        .then((d) => setFound(d.items.map((i) => ({ id: i.id, name: i.name, category: i.category }))))
        .catch(() => setFound([]))
        .finally(() => setSearching(false));
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  useEffect(() => setActive(0), [query, found.length]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, commands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commands[active]?.run();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  const groupLabel = { navigate: m.admin.palette.navigate, actions: m.admin.palette.actions, products: m.admin.palette.productsGroup };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] grid place-items-start justify-items-center bg-navy-950/70 px-4 pt-[14vh] backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={m.admin.palette.placeholder}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong gold-border w-full max-w-xl overflow-hidden rounded-3xl"
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
              <IconSearch className="h-5 w-5 text-gold-300" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={m.admin.palette.placeholder}
                aria-label={m.admin.palette.placeholder}
                className="w-full bg-transparent text-base text-pearl outline-none placeholder:text-pearl/35"
              />
              <span className="kbd">esc</span>
            </div>

            <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {commands.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-pearl/45">
                  {searching ? m.admin.palette.searching : m.admin.palette.empty}
                </li>
              )}
              {commands.map((c, i) => {
                const first = i === 0 || commands[i - 1].group !== c.group;
                return (
                  <li key={c.id}>
                    {first && (
                      <p className="px-3 pb-1 pt-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-pearl/35">
                        {groupLabel[c.group]}
                      </p>
                    )}
                    <button
                      type="button"
                      data-active={i === active}
                      onMouseMove={() => setActive(i)}
                      onClick={c.run}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                        i === active ? 'bg-gold-400/15 text-pearl' : 'text-pearl/75'
                      }`}
                    >
                      <span className={`grid h-8 w-8 place-items-center rounded-xl ${i === active ? 'bg-gold-400/25 text-gold-300' : 'bg-white/5 text-pearl/60'}`}>
                        {c.icon}
                      </span>
                      <span className="flex-1 truncate text-sm font-medium">{c.label}</span>
                      {c.hint && <span className="text-xs text-pearl/40">{c.hint}</span>}
                      {i === active && <span className="kbd">↵</span>}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-xs text-pearl/40">
              <span>{m.admin.palette.hint}</span>
              {searching && <span className="text-gold-300">{m.admin.palette.searching}</span>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
