'use client';

import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Component, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { IconArrowRight, IconCheck, IconLock, IconShield, IconUser } from '@/components/admin/AdminIcons';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Logo } from '@/components/Logo';
import { stripLocale } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';

// three.js loads only here, after the first paint
const LoginScene = dynamic(() => import('@/components/admin/LoginScene'), { ssr: false });

/** Pure-CSS drifting crystals: shown while the 3D scene loads or when WebGL is unavailable. */
function FallbackCrystals() {
  const shards = [
    { l: '8%', t: '18%', s: 90, dx: '20px', dy: '-30px', r: '10deg', d: '9s' },
    { l: '80%', t: '12%', s: 130, dx: '-26px', dy: '24px', r: '-14deg', d: '12s' },
    { l: '68%', t: '68%', s: 80, dx: '18px', dy: '-22px', r: '20deg', d: '10s' },
    { l: '14%', t: '72%', s: 120, dx: '-20px', dy: '-26px', r: '-8deg', d: '13s' },
    { l: '46%', t: '6%', s: 60, dx: '14px', dy: '20px', r: '30deg', d: '8s' },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {shards.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 100 140"
          className="absolute opacity-40"
          style={{ left: s.l, top: s.t, width: s.s, ['--dx' as string]: s.dx, ['--dy' as string]: s.dy, ['--r' as string]: s.r, animation: `drift ${s.d} ease-in-out infinite` }}
        >
          <polygon points="50,2 92,34 92,106 50,138 8,106 8,34" fill="rgba(239,217,168,0.12)" stroke="rgba(239,217,168,0.55)" strokeWidth="1.5" />
          <polygon points="50,2 70,34 50,138 30,34" fill="rgba(245,240,230,0.14)" />
        </svg>
      ))}
    </div>
  );
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

type Phase = 'idle' | 'loading' | 'success';

export default function AdminLoginPage() {
  const router = useRouter();
  const { m, href } = useI18n();
  const t = m.admin.login;
  const shake = useAnimationControls();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [supported, setSupported] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => setSupported(hasWebGL()), []);

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
      setPhase('success'); // crystals burst, then the panel opens
      setTimeout(() => router.replace(href(me.mustChangePassword ? '/admin/change-password' : '/admin')), 1250);
    } catch (err) {
      setError(errorText(err, m, t.failed));
      setPhase('idle');
      void shake.start({ x: [0, -14, 12, -9, 6, -3, 0], transition: { duration: 0.55 } });
    }
  }

  const success = phase === 'success';

  const fields = [
    { id: 'username', label: t.username, icon: <IconUser className="h-4.5 w-4.5" />, value: username, set: setUsername, type: 'text', auto: 'username' },
    { id: 'password', label: t.password, icon: <IconLock className="h-4.5 w-4.5" />, value: password, set: setPassword, type: show ? 'text' : 'password', auto: 'current-password' },
  ];

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      {/* 3D crystals */}
      <div className="absolute inset-0">
        {!ready && <FallbackCrystals />}
        {supported && (
          <SceneBoundary fallback={<FallbackCrystals />}>
            <div className={`absolute inset-0 transition-opacity duration-1000 ${ready ? 'opacity-100' : 'opacity-0'}`}>
              <LoginScene burst={success} onReady={() => setReady(true)} />
            </div>
          </SceneBoundary>
        )}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgb(6_18_41/0.75)_100%)]"
      />

      {/* flash when the crystals burst */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.95, 0.95] }}
            transition={{ duration: 1.25, times: [0, 0.45, 0.9, 1] }}
            className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_center,#fff7e0,#e0bd7a_45%,#0e2648_100%)]"
          />
        )}
      </AnimatePresence>

      <div className="absolute right-5 top-5 z-30">
        <LanguageSwitcher />
      </div>

      <motion.div animate={shake} className="relative z-10 w-full max-w-[26rem]">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.92, filter: 'blur(12px)' }}
          animate={
            success
              ? { opacity: 0, y: -30, scale: 0.94, filter: 'blur(10px)' }
              : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
          }
          transition={{ duration: success ? 0.7 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            className="mb-6 flex justify-center"
          >
            <Logo className="h-12" />
          </motion.div>

          <form onSubmit={onSubmit} noValidate className="glass-strong gold-border rounded-[2rem] bg-navy-900/70 p-8 sm:p-10">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="eyebrow flex items-center justify-center gap-2"
            >
              <IconShield className="h-3.5 w-3.5" /> {t.eyebrow}
            </motion.p>
            <h1 className="mt-3 text-center font-display text-4xl font-medium text-pearl">
              <span className="text-shimmer italic">{t.welcome}</span>
            </h1>
            <p className="mt-2 text-center text-sm text-pearl/55">{t.subtitle}</p>

            <div className="mt-8 space-y-4">
              {fields.map((f, i) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.55 + i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <label htmlFor={f.id} className="label">{f.label}</label>
                  <div className="group relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-pearl/35 transition-colors group-focus-within:text-gold-300">{f.icon}</span>
                    <input
                      id={f.id}
                      className={`field !pl-12 ${f.id === 'password' ? '!pr-20' : ''}`}
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-pearl/50 hover:text-gold-300"
                      >
                        {show ? t.hide : t.show}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 20 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={phase !== 'idle' || !username || !password}
              whileTap={{ scale: 0.98 }}
              className="btn btn-primary mt-7 w-full !py-3.5 text-base"
            >
              <AnimatePresence mode="wait" initial={false}>
                {phase === 'idle' && (
                  <motion.span key="i" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex items-center gap-2">
                    {t.submit} <IconArrowRight className="h-4 w-4" />
                  </motion.span>
                )}
                {phase === 'loading' && (
                  <motion.span key="l" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-950/30 border-t-navy-950" /> {t.submitting}
                  </motion.span>
                )}
                {phase === 'success' && (
                  <motion.span key="s" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2">
                    <IconCheck className="h-5 w-5" strokeWidth={3} /> {t.granted}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <p className="mt-5 flex items-center justify-center gap-2 text-xs text-pearl/40">
              <IconLock className="h-3.5 w-3.5 text-gold-400/70" /> {t.secure}
            </p>
          </form>
        </motion.div>
      </motion.div>
    </main>
  );
}
