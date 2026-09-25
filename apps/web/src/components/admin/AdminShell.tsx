'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { stripLocale } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { ApiError, api } from '@/lib/client-api';
import {
  IconCart,
  IconChart,
  IconContact,
  IconDashboard,
  IconExternal,
  IconGem,
  IconKey,
  IconLogout,
  IconMenu,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShield,
  IconUsers,
} from './AdminIcons';
import { CommandPalette } from './CommandPalette';
import { CrystalField } from './CrystalField';
import { ToastProvider } from './Toast';

interface Me {
  username: string;
  mustChangePassword: boolean;
}

const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext);

/** Confirms the session with the API before showing anything from the panel. */
export function AdminShell({ children, allowPasswordChange = false }: { children: ReactNode; allowPasswordChange?: boolean }) {
  const router = useRouter();
  const pathname = stripLocale(usePathname());
  const { m, href } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<Me>('/auth/me', { homePath: href('/'), changePasswordPath: href('/admin/change-password') })
      .then((data) => {
        if (cancelled) return;
        if (data.mustChangePassword && !allowPasswordChange) router.replace(href('/admin/change-password'));
        else setMe(data);
      })
      .catch((e) => {
        if (!(e instanceof ApiError) || e.status !== 401) console.error(e);
      });
    return () => {
      cancelled = true;
    };
    // href is derived from the locale, which is stable for this page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, allowPasswordChange]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', autoRedirect: false }).catch(() => {});
    window.location.assign(href('/'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ctrl/⌘ + K opens the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setDrawer(false), [pathname]);

  if (!me) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400"
          role="status"
          aria-label={m.common.loading}
        />
      </div>
    );
  }

  const nav = [
    { path: '/admin', label: m.admin.shell.dashboard, icon: IconDashboard, exact: true },
    { path: '/admin/products', label: m.admin.nav.products, icon: IconGem },
    { path: '/admin/sales', label: 'Vendas', icon: IconCart },
    { path: '/admin/customers', label: 'Clientes', icon: IconContact },
    { path: '/admin/finance', label: 'Financeiro', icon: IconChart },
    { path: '/admin/team', label: m.admin.shell.team, icon: IconUsers },
    { path: '/admin/settings', label: m.admin.shell.settings, icon: IconSettings },
    { path: '/admin/change-password', label: m.admin.nav.password, icon: IconKey },
  ];
  const isActive = (n: (typeof nav)[number]) => (n.exact ? pathname === n.path : pathname === n.path || pathname.startsWith(`${n.path}/`));
  const current = [...nav].reverse().find(isActive);
  const title = pathname === '/admin/sales/new' ? 'Registrar venda' : pathname.startsWith('/admin/sales/') ? 'Venda' : pathname === '/admin/products/new' ? m.admin.form.titleNew : pathname.startsWith('/admin/products/') ? m.admin.form.titleEdit : (current?.label ?? m.admin.panel);
  const full = !me.mustChangePassword;

  // plain render helpers (not components) so the active pill keeps its animation across renders
  const renderNav = (id: string) => (
    <nav aria-label={m.admin.nav.label} className="mt-8 flex flex-col gap-1">
      {nav.map((n) => {
        const active = isActive(n);
        const Icon = n.icon;
        return (
          <Link
            key={n.path}
            href={href(n.path)}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
              active ? 'text-pearl' : 'text-pearl/60 hover:text-pearl'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`nav-pill-${id}`}
                className="absolute inset-0 rounded-2xl border border-gold-400/25 bg-gradient-to-r from-gold-400/20 to-gold-400/[0.04]"
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              />
            )}
            <Icon className={`relative h-5 w-5 transition-colors ${active ? 'text-gold-300' : 'group-hover:text-gold-300'}`} />
            <span className="relative">{n.label}</span>
          </Link>
        );
      })}
      <a
        href={href('/')}
        target="_blank"
        rel="noopener"
        className="group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-pearl/60 transition-colors hover:text-pearl"
      >
        <IconExternal className="h-5 w-5 group-hover:text-gold-300" />
        {m.admin.nav.viewSite}
      </a>
    </nav>
  );

  const renderUser = () => (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 font-display text-xl font-semibold uppercase text-navy-950">
          {me.username.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-pearl">{me.username}</p>
          <p className="flex items-center gap-1 text-[0.7rem] text-gold-300/80">
            <IconShield className="h-3 w-3" /> {m.admin.shell.secure}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          title={m.admin.nav.logout}
          aria-label={m.admin.nav.logout}
          className="grid h-9 w-9 place-items-center rounded-xl text-pearl/55 transition-colors hover:bg-white/10 hover:text-pearl"
        >
          <IconLogout className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );

  return (
    <MeContext.Provider value={me}>
      <ToastProvider>
        <CrystalField />
        <div className="flex min-h-dvh">
          {/* Sidebar (desktop) */}
          {full && (
            <aside className="sticky top-0 hidden h-dvh w-[280px] shrink-0 p-4 lg:block">
              <div className="glass-strong flex h-full flex-col rounded-[1.75rem] p-5">
                <Logo className="h-9" />
                {renderNav('desktop')}
                <div className="mt-auto space-y-3 pt-6">
                  <Link href={href('/admin/products/new')} className="btn btn-primary w-full">
                    <IconPlus className="h-4 w-4" /> {m.admin.shell.newProduct}
                  </Link>
                  {renderUser()}
                </div>
              </div>
            </aside>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top bar */}
            <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-navy-950/60 backdrop-blur-xl">
              <div className="flex h-[68px] items-center gap-3 px-4 sm:px-8">
                {full ? (
                  <button
                    type="button"
                    onClick={() => setDrawer(true)}
                    aria-label={m.admin.shell.menu}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-pearl/80 lg:hidden"
                  >
                    <IconMenu className="h-5 w-5" />
                  </button>
                ) : (
                  <Logo className="h-8" />
                )}
                <h2 className="truncate font-display text-2xl font-medium text-pearl">{title}</h2>

                <div className="ml-auto flex items-center gap-2 sm:gap-3">
                  {full && (
                    <button
                      type="button"
                      onClick={() => setPalette(true)}
                      className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] py-2 pl-4 pr-2 text-sm text-pearl/50 transition-colors hover:border-gold-400/40 hover:text-pearl md:flex"
                    >
                      <IconSearch className="h-4 w-4" />
                      <span className="w-40 text-left">{m.admin.shell.search}</span>
                      <span className="kbd">Ctrl K</span>
                    </button>
                  )}
                  {full && (
                    <button
                      type="button"
                      onClick={() => setPalette(true)}
                      aria-label={m.admin.shell.search}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-pearl/80 md:hidden"
                    >
                      <IconSearch className="h-5 w-5" />
                    </button>
                  )}
                  {!full && (
                    <button onClick={logout} className="btn btn-ghost btn-sm">
                      {m.admin.nav.logout}
                    </button>
                  )}
                </div>
              </div>
            </header>

            <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-8 sm:px-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {full && drawer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-navy-950/70 backdrop-blur-sm lg:hidden"
              onClick={() => setDrawer(false)}
            >
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-strong flex h-full w-[300px] max-w-[86vw] flex-col rounded-r-[1.75rem] p-5"
              >
                <Logo className="h-9" />
                {renderNav('mobile')}
                <div className="mt-auto space-y-3 pt-6">
                  <Link href={href('/admin/products/new')} className="btn btn-primary w-full">
                    <IconPlus className="h-4 w-4" /> {m.admin.shell.newProduct}
                  </Link>
                  {renderUser()}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <CommandPalette open={palette} onClose={() => setPalette(false)} onLogout={logout} />
      </ToastProvider>
    </MeContext.Provider>
  );
}
