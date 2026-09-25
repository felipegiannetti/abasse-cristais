'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { getLoginAddress } from '@/app/actions';
import { fmt } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import type { TeamMember } from '@/lib/types';
import { IconCheck, IconCopy, IconKey, IconPlus, IconShield, IconTrash } from './AdminIcons';
import { Modal } from './Modal';
import { TiltCard } from './TiltCard';
import { useToast } from './Toast';

type Dialog =
  | { kind: 'add' }
  | { kind: 'remove'; user: TeamMember }
  | { kind: 'reset'; user: TeamMember }
  | { kind: 'credentials'; username: string; password: string; address: string | null; reset: boolean }
  | null;

function CopyRow({ label, value }: { label: string; value: string }) {
  const { m } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap rounded-xl border border-white/10 bg-navy-950/60 px-3 py-2.5 font-mono text-sm text-pearl">{value}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              /* clipboard unavailable: the value is selectable */
            }
          }}
          className="btn btn-ghost btn-sm shrink-0"
        >
          {copied ? <IconCheck className="h-4 w-4 text-gold-300" /> : <IconCopy className="h-4 w-4" />}
          {copied ? m.admin.team.copied : m.admin.team.copy}
        </button>
      </div>
    </div>
  );
}

export function TeamPage() {
  const { m, href } = useI18n();
  const t = m.admin.team;
  const toast = useToast();
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };

  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    api<TeamMember[]>('/admin/team', nav)
      .then(setTeam)
      .catch((e) => setError(errorText(e, m, t.loadFailed)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(load, [load]);

  const close = () => {
    if (busy) return;
    setDialog(null);
    setUsername('');
    setPassword('');
    setFormError('');
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!dialog || dialog.kind === 'credentials') return;
    setFormError('');
    setBusy(true);
    try {
      if (dialog.kind === 'add') {
        const res = await api<{ user: { username: string }; temporaryPassword: string }>('/admin/team', {
          method: 'POST',
          json: { username, currentPassword: password },
          ...nav,
        });
        const address = await getLoginAddress();
        setDialog({ kind: 'credentials', username: res.user.username, password: res.temporaryPassword, address, reset: false });
        load();
      } else if (dialog.kind === 'remove') {
        await api(`/admin/team/${dialog.user.id}/delete`, { method: 'POST', json: { currentPassword: password }, ...nav });
        toast(t.removed);
        setDialog(null);
        load();
      } else {
        const res = await api<{ temporaryPassword: string }>(`/admin/team/${dialog.user.id}/reset-password`, {
          method: 'POST',
          json: { currentPassword: password },
          ...nav,
        });
        const address = await getLoginAddress();
        setDialog({ kind: 'credentials', username: dialog.user.username, password: res.temporaryPassword, address, reset: true });
        load();
      }
      setPassword('');
      setUsername('');
    } catch (err) {
      setFormError(errorText(err, m));
    } finally {
      setBusy(false);
    }
  }

  const formOpen = dialog && dialog.kind !== 'credentials';
  const title =
    dialog?.kind === 'add'
      ? t.addTitle
      : dialog?.kind === 'remove'
        ? fmt(t.removeTitle, { name: dialog.user.username })
        : dialog?.kind === 'reset'
          ? fmt(t.resetTitle, { name: dialog.user.username })
          : '';
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl font-medium text-pearl sm:text-5xl">{t.title}</h1>
          <p className="mt-3 max-w-xl text-pearl/55">{t.subtitle}</p>
        </div>
        <button type="button" onClick={() => setDialog({ kind: 'add' })} className="btn btn-primary">
          <IconPlus className="h-4 w-4" /> {t.add}
        </button>
      </div>

      {error && <p role="alert" className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">{error}</p>}

      {!team && !error && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2" aria-busy="true">
          {[0, 1].map((i) => <div key={i} className="skeleton h-40" />)}
        </div>
      )}

      {team && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {team.map((u, i) => (
              <motion.li
                key={u.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <TiltCard className={`glass-strong h-full rounded-3xl p-6 ${u.isYou ? 'gold-border' : ''}`}>
                  <div className="flex items-center gap-4">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 font-display text-3xl font-semibold uppercase text-navy-950">
                      {u.username.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate font-display text-2xl text-pearl">
                        {u.username}
                        {u.isYou && <span className="rounded-full bg-gold-400/20 px-2 py-0.5 font-sans text-[0.65rem] font-bold uppercase tracking-wider text-gold-300">{t.you}</span>}
                      </p>
                      <p className="text-xs leading-snug text-pearl/45">
                        {u.createdBy ? fmt(t.createdBy, { name: u.createdBy }) : t.original} · {fmt(t.since, { date: fmtDate(u.createdAt) })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${u.mustChangePassword ? 'border-sky/40 bg-sky/10 text-sky' : 'border-gold-400/40 bg-gold-400/10 text-gold-300'}`}>
                      <IconShield className="h-3.5 w-3.5" /> {u.mustChangePassword ? t.pending : t.active}
                    </span>
                    {!u.isYou && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setDialog({ kind: 'reset', user: u })} className="btn btn-ghost btn-sm">
                          <IconKey className="h-4 w-4" /> {t.reset}
                        </button>
                        <button type="button" onClick={() => setDialog({ kind: 'remove', user: u })} className="btn btn-danger btn-sm" aria-label={`${t.remove}: ${u.username}`}>
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </TiltCard>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* add / remove / reset — always asks for the acting admin's password */}
      <Modal open={Boolean(formOpen)} onClose={close} title={title} busy={busy}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <p className="text-sm text-pearl/60">
            {dialog?.kind === 'add' ? t.addText : dialog?.kind === 'remove' ? t.removeText : t.resetText}
          </p>
          {dialog?.kind === 'add' && (
            <div>
              <label htmlFor="new-admin" className="label">{t.username}</label>
              <input
                id="new-admin"
                className="field"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={32}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
              <p className="mt-1.5 text-xs text-pearl/40">{t.usernameHint}</p>
            </div>
          )}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-pearl"><IconShield className="h-4 w-4 text-gold-300" /> {t.confirmTitle}</p>
            <p className="mt-1 text-xs text-pearl/45">{t.confirmText}</p>
            <label htmlFor="confirm-pw" className="label mt-3">{t.yourPassword}</label>
            <input id="confirm-pw" type="password" autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus={dialog?.kind !== 'add'} />
          </div>
          {formError && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{formError}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" className="btn btn-ghost btn-sm" onClick={close} disabled={busy}>{m.common.cancel}</button>
            <button
              type="submit"
              disabled={busy || !password || (dialog?.kind === 'add' && username.trim().length < 3)}
              className={`btn btn-sm ${dialog?.kind === 'remove' ? 'btn-danger' : 'btn-primary'}`}
            >
              {busy ? t.working : dialog?.kind === 'add' ? t.create : t.confirm}
            </button>
          </div>
        </form>
      </Modal>

      {/* the one-time credentials */}
      <Modal open={dialog?.kind === 'credentials'} onClose={() => setDialog(null)} title={dialog?.kind === 'credentials' ? (dialog.reset ? t.resetTitleDone : t.doneTitle) : ''} wide>
        {dialog?.kind === 'credentials' && (
          <div className="space-y-4">
            <p className="text-sm text-pearl/60">{t.shareText}</p>
            {dialog.address && <CopyRow label={t.address} value={dialog.address} />}
            <CopyRow label={t.username} value={dialog.username} />
            <CopyRow label={t.passwordLabel} value={dialog.password} />
            <p className="flex items-start gap-2 rounded-xl border border-gold-400/25 bg-gold-400/[0.06] px-4 py-3 text-xs text-gold-300">
              <IconShield className="mt-0.5 h-4 w-4 shrink-0" /> {t.warn}
            </p>
            <div className="flex justify-end pt-1">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setDialog(null)}>{t.done}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
