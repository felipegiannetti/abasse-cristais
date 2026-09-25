'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Logo } from '@/components/Logo';
import { useI18n } from '@/i18n/provider';
import { ApiError, api } from '@/lib/client-api';
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
  const { m, href } = useI18n();
  const [me, setMe] = useState<Me | null>(null);

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

  async function logout() {
    await api('/auth/logout', { method: 'POST', autoRedirect: false }).catch(() => {});
    window.location.assign(href('/'));
  }

  if (!me) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-jade-400/30 border-t-jade-400"
          role="status"
          aria-label={m.common.loading}
        />
      </div>
    );
  }

  return (
    <MeContext.Provider value={me}>
      <ToastProvider>
        <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-ink-950/75 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
            <div className="flex items-center gap-4">
              <Logo className="h-8" />
              <span className="hidden rounded-full border border-jade-400/30 bg-jade-400/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-jade-300 sm:inline">
                {m.admin.panel}
              </span>
            </div>
            <nav className="flex items-center gap-1 text-sm sm:gap-2" aria-label={m.admin.nav.label}>
              {!me.mustChangePassword && (
                <>
                  <Link href={href('/admin')} className="rounded-full px-3 py-2 text-ice/75 hover:bg-white/5 hover:text-ice">
                    {m.admin.nav.products}
                  </Link>
                  <Link
                    href={href('/admin/change-password')}
                    className="hidden rounded-full px-3 py-2 text-ice/75 hover:bg-white/5 hover:text-ice sm:block"
                  >
                    {m.admin.nav.password}
                  </Link>
                  <a
                    href={href('/')}
                    target="_blank"
                    rel="noopener"
                    className="hidden rounded-full px-3 py-2 text-ice/75 hover:bg-white/5 hover:text-ice sm:block"
                  >
                    {m.admin.nav.viewSite}
                  </a>
                </>
              )}
              <LanguageSwitcher />
              <button onClick={logout} className="btn btn-ghost btn-sm">
                {m.admin.nav.logout}
              </button>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">{children}</main>
      </ToastProvider>
    </MeContext.Provider>
  );
}
