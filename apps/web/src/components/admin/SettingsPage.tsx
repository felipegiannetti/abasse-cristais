'use client';

import { motion } from 'motion/react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { revalidateCatalog } from '@/app/actions';
import { useI18n } from '@/i18n/provider';
import type { TemplatesMap } from '@/i18n/templates';
import { api, errorText } from '@/lib/client-api';
import { emailUrl, generalEmailBody, generalEmailSubject, generalSms, smsUrl } from '@/lib/contact';
import { generalMessage, whatsappUrl } from '@/lib/whatsapp';
import { IconCheck, IconExternal, IconMail, IconSms } from './AdminIcons';
import { MessageTemplatesCard } from './MessageTemplatesCard';
import { useToast } from './Toast';

interface ContactSettings {
  whatsapp: string;
  sms: string;
  email: string;
  templates: TemplatesMap;
}

/** Mirrors the API's normalization so the admin sees exactly what will be saved. */
function previewWhatsappDigits(input: string): string {
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

const previewPhoneDigits = (input: string) => (/^[+\d\s().-]+$/.test(input.trim()) ? input.trim().replace(/\D/g, '') : '');
const validPhone = (digits: string) => /^[1-9]\d{9,14}$/.test(digits);
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function SettingsPage() {
  const { m, href } = useI18n();
  const t = m.admin.settingsPage;
  const toast = useToast();
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };

  const [saved, setSaved] = useState<ContactSettings | null>(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [sms, setSms] = useState('');
  const [email, setEmail] = useState('');
  const [templates, setTemplates] = useState<TemplatesMap>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<ContactSettings>('/admin/settings', nav)
      .then((d) => {
        setSaved(d);
        setWhatsapp(d.whatsapp);
        setSms(d.sms);
        setEmail(d.email);
        setTemplates(d.templates);
      })
      .catch((e) => setError(errorText(e, m, t.loadFailed)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const waDigits = previewWhatsappDigits(whatsapp);
  const waEmpty = whatsapp.trim() === '';
  const waOk = waEmpty || validPhone(waDigits);

  const smsDigits = previewPhoneDigits(sms);
  const smsEmpty = sms.trim() === '';
  const smsOk = smsEmpty || validPhone(smsDigits);

  const emailEmpty = email.trim() === '';
  const emailOk = emailEmpty || validEmail(email);

  const ok = waOk && smsOk && emailOk;
  const dirty =
    saved !== null &&
    (waDigits !== saved.whatsapp ||
      smsDigits !== saved.sms ||
      email.trim().toLowerCase() !== saved.email ||
      JSON.stringify(templates) !== JSON.stringify(saved.templates));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setError('');
    setSaving(true);
    try {
      const res = await api<ContactSettings>('/admin/settings', {
        method: 'PUT',
        json: { whatsapp, sms, email, templates },
        ...nav,
      });
      setSaved(res);
      setWhatsapp(res.whatsapp);
      setSms(res.sms);
      setEmail(res.email);
      setTemplates(res.templates);
      await revalidateCatalog(); // the whole public site picks the new settings up immediately
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

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-6">
        <Card
          icon={
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden="true">
              <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.8a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88z" />
            </svg>
          }
          title={t.whatsapp.title}
          help={t.whatsapp.help}
        >
          <label htmlFor="wa" className="label">{t.whatsapp.label}</label>
          <div className="relative">
            <input
              id="wa"
              className={`field !pr-12 text-lg ${!waOk ? '!border-red-400/60' : ''}`}
              inputMode="tel"
              autoComplete="off"
              value={whatsapp}
              maxLength={200}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder={t.whatsapp.placeholder}
              disabled={saved === null && !error}
            />
            {validPhone(waDigits) && <ValidBadge />}
          </div>
          {!waOk && <p className="mt-2 text-sm text-red-300">{m.errors.INVALID_WHATSAPP}</p>}
          {waEmpty && <p className="mt-2 text-xs text-pearl/40">{saved?.whatsapp === '' ? t.whatsapp.notSet : t.whatsapp.leaveEmpty}</p>}
          {!waEmpty && <p className="mt-2 text-xs text-pearl/40">{t.whatsapp.digitsOnly}</p>}

          {validPhone(waDigits) && (
            <Preview code={`wa.me/${waDigits}`} href={whatsappUrl(generalMessage(m), waDigits)} label={t.whatsapp.test} />
          )}
        </Card>

        <Card icon={<IconSms className="h-7 w-7" />} title={t.sms.title} help={t.sms.help}>
          <label htmlFor="sms" className="label">{t.sms.label}</label>
          <div className="relative">
            <input
              id="sms"
              className={`field !pr-12 text-lg ${!smsOk ? '!border-red-400/60' : ''}`}
              inputMode="tel"
              autoComplete="off"
              value={sms}
              maxLength={200}
              onChange={(e) => setSms(e.target.value)}
              placeholder={t.sms.placeholder}
              disabled={saved === null && !error}
            />
            {validPhone(smsDigits) && <ValidBadge />}
          </div>
          {!smsOk && <p className="mt-2 text-sm text-red-300">{m.errors.INVALID_SMS_PHONE}</p>}
          {smsEmpty && <p className="mt-2 text-xs text-pearl/40">{t.sms.notSet}</p>}
          {!smsEmpty && <p className="mt-2 text-xs text-pearl/40">{t.sms.digitsOnly}</p>}

          {validPhone(smsDigits) && (
            <Preview code={`sms:${smsDigits}`} href={smsUrl(smsDigits, generalSms(m))} label={t.sms.test} />
          )}
        </Card>

        <Card icon={<IconMail className="h-7 w-7" />} title={t.email.title} help={t.email.help}>
          <label htmlFor="email" className="label">{t.email.label}</label>
          <div className="relative">
            <input
              id="email"
              type="email"
              className={`field !pr-12 text-lg ${!emailOk ? '!border-red-400/60' : ''}`}
              autoComplete="off"
              value={email}
              maxLength={254}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.email.placeholder}
              disabled={saved === null && !error}
            />
            {validEmail(email) && <ValidBadge />}
          </div>
          {!emailOk && <p className="mt-2 text-sm text-red-300">{m.errors.INVALID_EMAIL}</p>}
          {emailEmpty && <p className="mt-2 text-xs text-pearl/40">{t.email.notSet}</p>}

          {validEmail(email) && (
            <Preview
              code={email.trim().toLowerCase()}
              href={emailUrl(email.trim(), generalEmailSubject(m), generalEmailBody(m))}
              label={t.email.test}
            />
          )}
        </Card>

        <MessageTemplatesCard templates={templates} onChange={setTemplates} disabled={saved === null} />

        {error && (
          <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving || !ok || !dirty} className="btn btn-primary">
            {saving ? t.saving : t.save}
          </button>
        </div>
      </form>
    </div>
  );
}

function Card({ icon, title, help, children }: { icon: ReactNode; title: string; help: string; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass-strong gold-border rounded-[2rem] p-7 sm:p-9"
    >
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-600 text-navy-950">
          {icon}
        </span>
        <div>
          <h2 className="font-display text-3xl text-pearl">{title}</h2>
        </div>
      </div>
      <p className="mt-5 text-sm leading-relaxed text-pearl/60">{help}</p>
      <div className="mt-6">{children}</div>
    </motion.div>
  );
}

function ValidBadge() {
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-gold-400 text-navy-950"
    >
      <IconCheck className="h-4 w-4" strokeWidth={3} />
    </motion.span>
  );
}

function Preview({ code, href, label }: { code: string; href: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mt-6 overflow-hidden rounded-2xl border border-gold-400/25 bg-gold-400/[0.06] p-4"
    >
      <p className="break-all font-mono text-sm text-pearl/80">{code}</p>
      <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm mt-3">
        <IconExternal className="h-4 w-4" /> {label}
      </a>
    </motion.div>
  );
}
