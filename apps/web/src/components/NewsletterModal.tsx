'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/provider';
import { MailIcon } from './icons';

const DISMISSED_KEY = 'newsletter_dismissed_v1';
const SUBSCRIBED_KEY = 'newsletter_subscribed_v1';
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Shown once per visitor (localStorage, not a cookie — nothing is tracked server-side until they
 * actually submit an email). Closing or dismissing it never shows it again on that browser.
 */
export function NewsletterModal() {
  const { m, locale, href } = useI18n();
  const t = m.newsletterModal;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY) || localStorage.getItem(SUBSCRIBED_KEY)) return;
    } catch {
      return; // storage unavailable (private mode, blocked cookies…): never force the modal on
    }
    const timer = setTimeout(() => setOpen(true), 1600);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* best effort */
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!SIMPLE_EMAIL_RE.test(value)) {
      setStatus('error');
      setErrorMsg(t.invalidEmail);
      return;
    }
    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value, locale }),
      });
      if (!res.ok) throw new Error('subscribe failed');
      setStatus('success');
      try {
        localStorage.setItem(SUBSCRIBED_KEY, '1');
      } catch {
        /* best effort */
      }
    } catch {
      setStatus('error');
      setErrorMsg(t.genericError);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] grid place-items-center bg-navy-950/80 px-5"
          onClick={dismiss}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="newsletter-title"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong gold-border relative w-full max-w-md rounded-3xl p-7 sm:p-8"
          >
            <button
              type="button"
              aria-label={t.close}
              onClick={dismiss}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg text-pearl/50 transition-colors hover:bg-white/10 hover:text-pearl"
            >
              ×
            </button>

            {status === 'success' ? (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-gold-400/15 text-gold-300">
                  <MailIcon className="h-7 w-7" />
                </span>
                <p className="mt-4 text-pearl">{t.success}</p>
              </div>
            ) : (
              <>
                <p className="eyebrow">{t.eyebrow}</p>
                <h2 id="newsletter-title" className="mt-2 font-display text-2xl font-semibold text-pearl">
                  {t.title}
                </h2>
                <p className="mt-3 text-sm text-pearl/65">{t.text}</p>

                <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    placeholder={t.placeholder}
                    aria-label={t.placeholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field"
                  />
                  {status === 'error' && (
                    <p role="alert" className="text-sm text-red-300">
                      {errorMsg}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button type="submit" disabled={status === 'submitting'} className="btn btn-primary">
                      {status === 'submitting' ? t.submitting : t.submit}
                    </button>
                    <button type="button" onClick={dismiss} className="btn btn-ghost">
                      {t.dismiss}
                    </button>
                  </div>
                </form>

                <p className="mt-4 text-xs leading-relaxed text-pearl/40">
                  {t.consent}{' '}
                  <Link href={href('/privacy')} className="underline hover:text-pearl/60">
                    {m.footer.privacy}
                  </Link>
                  .
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
