'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import { useMe } from './AdminShell';

// Same rules the API enforces (order matches m.admin.password.rules).
const ruleTests = [
  (v: string) => v.length >= 12,
  (v: string) => /[a-z]/.test(v),
  (v: string) => /[A-Z]/.test(v),
  (v: string) => /\d/.test(v),
];

export function ChangePasswordForm() {
  const router = useRouter();
  const { m, href } = useI18n();
  const t = m.admin.password;
  const me = useMe();
  const forced = me?.mustChangePassword ?? false;

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      <h1 className="mt-3 font-display text-4xl font-medium text-ice sm:text-5xl">{forced ? t.titleForced : t.title}</h1>
      {forced && (
        <p className="mt-4 rounded-2xl border border-jade-400/25 bg-jade-400/[0.07] px-5 py-4 text-sm leading-relaxed text-ice/80">
          {t.forcedNote}
        </p>
      )}

      <form onSubmit={onSubmit} className="glass mt-8 space-y-5 rounded-[1.75rem] p-8" noValidate>
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
          <input id="new" type="password" autoComplete="new-password" className="field" required value={next} onChange={(e) => setNext(e.target.value)} />
          <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {t.rules.map((label, i) => {
              const ok = ruleTests[i](next);
              return (
                <li key={label} className={`flex items-center gap-2 transition-colors ${ok ? 'text-jade-300' : 'text-ice/45'}`}>
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
          <input id="confirm" type="password" autoComplete="new-password" className="field" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
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
    </div>
  );
}
