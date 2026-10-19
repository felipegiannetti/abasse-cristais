'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import { useMe } from './AdminShell';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';

// Same rules the API enforces (order matches m.admin.password.rules).
const ruleTests = [
  (v: string) => v.length >= 12,
  (v: string) => /[a-z]/.test(v),
  (v: string) => /[A-Z]/.test(v),
  (v: string) => /\d/.test(v),
];

export function ChangePasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const { m, href } = useI18n();
  const t = m.admin.password;
  const me = useMe();
  const forced = me?.mustChangePassword ?? false;

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOutEverywhere() {
    setSigningOut(true);
    try {
      await api('/auth/sign-out-everywhere', { method: 'POST', autoRedirect: false });
      window.location.assign(href('/'));
    } catch (err) {
      toast(errorText(err, m, t.signOutFailed), 'error');
      setSigningOut(false);
      setConfirmSignOut(false);
    }
  }

  const allRules = ruleTests.every((test) => test(next));
  const matches = next.length > 0 && next === confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        json: { currentPassword: current, newPassword: next },
        autoRedirect: false,
      });
      // full load so the panel re-checks the session (the cookie was renewed)
      window.location.assign(href('/admin'));
    } catch (err) {
      setError(errorText(err, m, t.failed));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <p className="eyebrow">{forced ? t.firstAccess : t.security}</p>
      <h1 className="mt-3 font-display text-2xl font-semibold text-pearl sm:text-3xl">{forced ? t.titleForced : t.title}</h1>
      {forced && (
        <p className="mt-4 rounded-2xl border border-gold-400/25 bg-gold-400/[0.07] px-5 py-4 text-sm leading-relaxed text-pearl/80">
          {t.forcedNote}
        </p>
      )}

      <form onSubmit={onSubmit} className="glass-strong gold-border mt-8 space-y-5 rounded-3xl p-8" noValidate>
        <div>
          <label htmlFor="current" className="label">
            {forced ? t.initial : t.current}
          </label>
          <input id="current" type="password" autoComplete="current-password" className="field" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label htmlFor="new" className="label">
            {t.next}
          </label>
          <div className="relative">
            <input
              id="new"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              className="field !pr-20"
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-2 text-xs font-semibold uppercase tracking-wider text-pearl/50 hover:text-gold-300 sm:py-1"
            >
              {show ? t.hide : t.show}
            </button>
          </div>
          <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {t.rules.map((label, i) => {
              const ok = ruleTests[i](next);
              return (
                <li key={label} className={`flex items-center gap-2 transition-colors ${ok ? 'text-gold-300' : 'text-pearl/45'}`}>
                  <span aria-hidden="true">{ok ? '✓' : '○'}</span>
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            {t.confirm}
          </label>
          <input
            id="confirm"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            className="field"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {confirm.length > 0 && !matches && <p className="mt-2 text-sm text-red-300">{t.mismatch}</p>}
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" disabled={loading || !current || !allRules || !matches} className="btn btn-primary">
            {loading ? t.saving : t.save}
          </button>
          {!forced && (
            <button type="button" className="btn btn-ghost" onClick={() => router.push(href('/admin'))}>
              {m.common.cancel}
            </button>
          )}
        </div>
      </form>

      {!forced && (
        <div className="glass-strong mt-6 rounded-3xl p-8">
          <h2 className="font-display text-2xl text-pearl">{t.sessionsTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-pearl/60">{t.sessionsHelp}</p>
          <button type="button" className="btn btn-danger mt-5" onClick={() => setConfirmSignOut(true)}>
            {t.signOutEverywhere}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmSignOut}
        title={t.signOutConfirmTitle}
        message={t.signOutConfirmText}
        confirmLabel={t.signOutEverywhere}
        loadingLabel={t.signingOut}
        loading={signingOut}
        onConfirm={signOutEverywhere}
        onCancel={() => setConfirmSignOut(false)}
      />
    </div>
  );
}
