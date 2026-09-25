'use client';

import { motion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import { revalidateCatalog } from '@/app/actions';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import { generalMessage, whatsappUrl } from '@/lib/whatsapp';
import { IconCheck, IconExternal } from './AdminIcons';
import { useToast } from './Toast';

/** Mirrors the API's normalization so the admin sees exactly what will be saved. */
function previewDigits(input: string): string {
  const raw = input.trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const h = u.hostname.toLowerCase();
      if (h === 'wa.me') return u.pathname.replace(/\D/g, '');
      if (h === 'api.whatsapp.com' || h === 'web.whatsapp.com') return (u.searchParams.get('phone') ?? '').replace(/\D/g, '');
    } catch {
      /* invalid URL */
    }
    return '';
  }
  return /^[+\d\s().-]+$/.test(raw) ? raw.replace(/\D/g, '') : '';
}

const valid = (digits: string) => /^[1-9]\d{9,14}$/.test(digits);

export function SettingsPage() {
  const { m, href } = useI18n();
  const t = m.admin.settingsPage;
  const toast = useToast();
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };

  const [saved, setSaved] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ whatsapp: string }>('/admin/settings', nav)
      .then((d) => {
        setSaved(d.whatsapp);
        setValue(d.whatsapp);
      })
      .catch((e) => setError(errorText(e, m, t.loadFailed)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const digits = previewDigits(value);
  const empty = value.trim() === '';
  const ok = empty || valid(digits);
  const dirty = saved !== null && digits !== saved && !(empty && saved === '');
  const link = valid(digits) ? whatsappUrl(generalMessage(m), digits) : '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setError('');
    setSaving(true);
    try {
      const res = await api<{ whatsapp: string }>('/admin/settings', { method: 'PUT', json: { whatsapp: value }, ...nav });
      setSaved(res.whatsapp);
      setValue(res.whatsapp);
      await revalidateCatalog(); // the whole public site picks the new number up immediately
      toast(t.saved);
    } catch (err) {
      setError(errorText(err, m, t.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl font-medium text-pearl sm:text-5xl">{t.title}</h1>
      <p className="mt-3 text-pearl/55">{t.subtitle}</p>

      <motion.form
        onSubmit={onSubmit}
        noValidate
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong gold-border mt-8 rounded-[2rem] p-7 sm:p-9"
      >
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-600 text-navy-950">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden="true">
              <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.8a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88z" />
            </svg>
          </span>
          <div>
            <h2 className="font-display text-3xl text-pearl">{t.whatsappTitle}</h2>
            <p className="text-sm text-pearl/50">{t.digitsOnly}</p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-pearl/60">{t.whatsappHelp}</p>

        <div className="mt-6">
          <label htmlFor="wa" className="label">{t.label}</label>
          <div className="relative">
            <input
              id="wa"
              className={`field !pr-12 text-lg ${!ok ? '!border-red-400/60' : ''}`}
              inputMode="tel"
              autoComplete="off"
              value={value}
              maxLength={200}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t.placeholder}
              disabled={saved === null && !error}
            />
            {valid(digits) && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-gold-400 text-navy-950"
              >
                <IconCheck className="h-4 w-4" strokeWidth={3} />
              </motion.span>
            )}
          </div>
          {!ok && <p className="mt-2 text-sm text-red-300">{m.errors.INVALID_WHATSAPP}</p>}
          {empty && <p className="mt-2 text-xs text-pearl/40">{saved === '' ? t.notSet : t.leaveEmpty}</p>}
        </div>

        {/* what the buttons will open */}
        {valid(digits) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-6 overflow-hidden rounded-2xl border border-gold-400/25 bg-gold-400/[0.06] p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-300">{t.previewTitle}</p>
            <p className="mt-1 break-all font-mono text-sm text-pearl/80">wa.me/{digits}</p>
            <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm mt-3">
              <IconExternal className="h-4 w-4" /> {t.test}
            </a>
          </motion.div>
        )}

        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
        )}

        <div className="mt-8 flex items-center gap-3">
          <button type="submit" disabled={saving || !ok || !dirty} className="btn btn-primary">
            {saving ? t.saving : t.save}
          </button>
          {!dirty && saved !== null && saved !== '' && (
            <span className="flex items-center gap-1.5 text-sm text-gold-300">
              <IconCheck className="h-4 w-4" /> wa.me/{saved}
            </span>
          )}
        </div>
      </motion.form>
    </div>
  );
}
