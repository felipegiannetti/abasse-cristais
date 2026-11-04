'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { fmt } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import { usd } from '@/lib/format';
import { useApiResource } from '@/lib/useApiResource';
import type { NewsletterOverview, Product, ProductList } from '@/lib/types';
import { IconClose, IconGem, IconMail, IconSearch } from './AdminIcons';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';

type PickedProduct = Pick<Product, 'id' | 'name' | 'priceCents'>;

export function NewsletterPage() {
  const { m, href } = useI18n();
  const t = m.admin.newsletter;
  const toast = useToast();
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };

  const { data, error, reload } = useApiResource<NewsletterOverview>('/admin/newsletter', t.loadFailed);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [picked, setPicked] = useState<PickedProduct[]>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<PickedProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');

  // live product search (same debounce as the command palette)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFound([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      api<ProductList>(`/admin/products?pageSize=8&q=${encodeURIComponent(q)}`, nav)
        .then((d) => setFound(d.items.filter((p) => !picked.some((s) => s.id === p.id))))
        .catch(() => setFound([]))
        .finally(() => setSearching(false));
    }, 220);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function addProduct(p: PickedProduct) {
    setPicked((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p]));
    setFound((cur) => cur.filter((x) => x.id !== p.id));
    setQuery('');
  }
  function removeProduct(id: string) {
    setPicked((cur) => cur.filter((x) => x.id !== id));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!subject.trim()) return setFormError(t.errSubject);
    if (!body.trim()) return setFormError(t.errBody);
    setConfirming(true);
  }

  async function confirmSend() {
    setSending(true);
    try {
      const res = await api<{ recipientCount: number }>('/admin/newsletter/send', {
        method: 'POST',
        json: { subject: subject.trim(), body: body.trim(), productIds: picked.map((p) => p.id) },
        ...nav,
      });
      toast(fmt(t.sent, { n: res.recipientCount }));
      setSubject('');
      setBody('');
      setPicked([]);
      setConfirming(false);
      reload();
    } catch (err) {
      setFormError(errorText(err, m, t.sendFailed));
      setConfirming(false);
    } finally {
      setSending(false);
    }
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div>
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-pearl sm:text-3xl">{t.title}</h1>
        <p className="mt-3 max-w-xl text-pearl/55">{t.subtitle}</p>
      </div>

      {error && <p role="alert" className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">{error}</p>}

      {data && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-pearl/70">
          <IconMail className="h-4 w-4 text-gold-300" />
          {data.activeSubscribers === 1 ? t.subscribersOne : fmt(t.subscribersMany, { n: data.activeSubscribers })}
        </p>
      )}

      <form onSubmit={submit} className="glass-strong mt-6 space-y-5 rounded-3xl p-6 sm:p-8" noValidate>
        <h2 className="font-display text-xl text-pearl">{t.composeTitle}</h2>

        <div>
          <label htmlFor="nl-subject" className="label">{t.subject}</label>
          <input id="nl-subject" className="field" maxLength={150} placeholder={t.subjectPh} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        <div>
          <label htmlFor="nl-body" className="label">{t.body}</label>
          <textarea id="nl-body" className="field min-h-40 resize-y" maxLength={5000} placeholder={t.bodyPh} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        <div>
          <label htmlFor="nl-search" className="label">{t.productsLabel}</label>
          <p className="mb-2 text-xs text-pearl/45">{t.productsHelp}</p>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pearl/40" />
            <input id="nl-search" className="field pl-9" placeholder={t.searchProducts} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {query.trim().length >= 2 && (
            <ul className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-navy-950/60">
              {found.length === 0 && (
                <li className="px-4 py-3 text-sm text-pearl/45">{searching ? m.admin.palette.searching : t.searchEmpty}</li>
              )}
              {found.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-pearl/80 transition-colors hover:bg-white/5"
                  >
                    <IconGem className="h-4 w-4 shrink-0 text-gold-300" />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="shrink-0 text-xs text-pearl/40">{p.priceCents != null ? usd(p.priceCents) : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {picked.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {picked.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 py-1 pl-3 pr-1.5 text-xs text-pearl">
                  {p.name}
                  <button
                    type="button"
                    onClick={() => removeProduct(p.id)}
                    aria-label={`${t.remove}: ${p.name}`}
                    className="grid h-5 w-5 place-items-center rounded-full transition-colors hover:bg-white/10"
                  >
                    <IconClose className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {formError && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{formError}</p>}

        <div className="flex justify-end">
          <button type="submit" disabled={sending} className="btn btn-primary">
            <IconMail className="h-4 w-4" /> {t.send}
          </button>
        </div>
      </form>

      <div className="mt-10">
        <h2 className="font-display text-xl text-pearl">{t.historyTitle}</h2>
        {data && data.campaigns.length === 0 && <p className="mt-3 text-sm text-pearl/45">{t.historyEmpty}</p>}
        {data && data.campaigns.length > 0 && (
          <ul className="mt-4 space-y-3">
            {data.campaigns.map((c) => (
              <li key={c.id} className="glass rounded-2xl px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-pearl">{c.subject}</p>
                  <span className="text-xs text-pearl/45">{fmtDate(c.sentAt)}</span>
                </div>
                <p className="mt-1 text-xs text-pearl/45">
                  {c.recipientCount === 1 ? t.recipientsOne : fmt(t.recipientsMany, { n: c.recipientCount })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title={fmt(t.confirmTitle, { n: data?.activeSubscribers ?? 0 })}
        message={t.confirmText}
        confirmLabel={t.confirmButton}
        loadingLabel={t.sending}
        loading={sending}
        onConfirm={confirmSend}
        onCancel={() => !sending && setConfirming(false)}
      />
    </div>
  );
}
