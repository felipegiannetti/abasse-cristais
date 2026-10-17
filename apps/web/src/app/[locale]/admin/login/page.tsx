'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { IconArrowRight, IconCheck, IconLock, IconShield, IconUser } from '@/components/admin/AdminIcons';
import { Logo } from '@/components/Logo';
import { stripLocale } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';

type Phase = 'idle' | 'loading' | 'success';

export default function AdminLoginPage() {
  const router = useRouter();
  const { m, href } = useI18n();
  const t = m.admin.login;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (phase !== 'idle') return;
    setError('');
    setPhase('loading');
    try {
      const me = await api<{ mustChangePassword: boolean }>('/auth/login', {
        method: 'POST',
        json: { username, password },
        autoRedirect: false,
        // The API only accepts logins that prove knowledge of the secret address (the path segment).
        headers: { 'X-Admin-Login-Token': stripLocale(window.location.pathname).replace(/^\/+|\/+$/g, '') },
      });
      setPhase('success');
      setTimeout(() => router.replace(href(me.mustChangePassword ? '/admin/change-password' : '/admin')), 350);
    } catch (err) {
      setError(errorText(err, m, t.failed));
      setPhase('idle');
    }
  }

  const fields = [
    { id: 'username', label: t.username, icon: <IconUser className="h-4.5 w-4.5" />, value: username, set: setUsername, type: 'text', auto: 'username' },
    { id: 'password', label: t.password, icon: <IconLock className="h-4.5 w-4.5" />, value: password, set: setPassword, type: show ? 'text' : 'password', auto: 'current-password' },
  ];

  return (
    <main className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo className="h-11" />
        </div>

        <form onSubmit={onSubmit} noValidate className="glass-strong rounded-3xl p-7 sm:p-8">
          <p className="eyebrow flex items-center justify-center gap-2">
            <IconShield className="h-3.5 w-3.5" /> {t.eyebrow}
          </p>
          <h1 className="mt-3 text-center font-display text-2xl font-semibold text-pearl">{t.welcome}</h1>
          <p className="mt-1.5 text-center text-sm text-pearl/55">{t.subtitle}</p>

          <div className="mt-7 space-y-4">
            {fields.map((f) => (
              <div key={f.id}>
                <label htmlFor={f.id} className="label">{f.label}</label>
                <div className="group relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-pearl/35 transition-colors group-focus-within:text-gold-300">{f.icon}</span>
                  <input
                    id={f.id}
                    className={`field !pl-11 ${f.id === 'password' ? '!pr-20' : ''}`}
                    type={f.type}
                    autoComplete={f.auto}
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={f.value}
                    disabled={phase !== 'idle'}
                    onChange={(e) => f.set(e.target.value)}
                  />
                  {f.id === 'password' && (
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-pearl/50 hover:text-gold-300"
                    >
                      {show ? t.hide : t.show}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p role="alert" className="mt-5 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <button type="submit" disabled={phase !== 'idle' || !username || !password} className="btn btn-primary mt-6 w-full !py-3 text-base">
            {phase === 'idle' && (
              <span className="flex items-center gap-2">
                {t.submit} <IconArrowRight className="h-4 w-4" />
              </span>
            )}
            {phase === 'loading' && (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-950/30 border-t-navy-950" /> {t.submitting}
              </span>
            )}
            {phase === 'success' && (
              <span className="flex items-center gap-2">
                <IconCheck className="h-5 w-5" strokeWidth={3} /> {t.granted}
              </span>
            )}
          </button>

          <p className="mt-5 flex items-center justify-center gap-2 text-xs text-pearl/40">
            <IconLock className="h-3.5 w-3.5 text-gold-400/70" /> {t.secure}
          </p>
        </form>
      </div>
    </main>
  );
}
