'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Logo } from '@/components/Logo';
import { stripLocale } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';

export default function AdminLoginPage() {
  const router = useRouter();
  const { m, href } = useI18n();
  const t = m.admin.login;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const me = await api<{ mustChangePassword: boolean }>('/auth/login', {
        method: 'POST',
        json: { username, password },
        autoRedirect: false,
        // The API only accepts logins that prove knowledge of the secret address (the path segment).
        headers: { 'X-Admin-Login-Token': stripLocale(window.location.pathname).replace(/^\/+|\/+$/g, '') },
      });
      router.replace(href(me.mustChangePassword ? '/admin/change-password' : '/admin'));
    } catch (err) {
      setError(errorText(err, m, t.failed));
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12">
      <div className="absolute right-5 top-5">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo className="h-12" />
        </div>

        <form onSubmit={onSubmit} className="glass rounded-[1.75rem] p-8 sm:p-10" noValidate>
          <p className="eyebrow text-center">{t.eyebrow}</p>
          <h1 className="mt-3 text-center font-display text-4xl font-medium text-ice">{t.title}</h1>

          <div className="mt-8 space-y-5">
            <div>
              <label htmlFor="username" className="label">
                {t.username}
              </label>
              <input
                id="username"
                className="field"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="label">
                {t.password}
              </label>
              <div className="relative">
                <input
                  id="password"
                  className="field !pr-20"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-ice/50 hover:text-jade-300"
                >
                  {show ? t.hide : t.show}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading || !username || !password} className="btn btn-primary mt-8 w-full">
            {loading ? t.submitting : t.submit}
          </button>
        </form>
      </div>
    </main>
  );
}
