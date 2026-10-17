'use client';

import { useState } from 'react';
import type { ProductLocale, ProductTranslation, ProductTranslations } from '@/lib/types';

const TABS: { key: ProductLocale; label: string; name: string }[] = [
  { key: 'en', label: 'EN', name: 'Inglês' },
  { key: 'pt', label: 'PT', name: 'Português' },
  { key: 'es', label: 'ES', name: 'Espanhol' },
];
const FIELDS = ['name', 'category', 'description'] as const;

/**
 * Per-language texts of a product. The fields typed in "Dados do cristal" are the original; anything left blank
 * here falls back to it, so only what differs between languages needs filling in.
 */
export function TranslationsEditor({
  value,
  onChange,
  original,
  disabled,
}: {
  value: ProductTranslations;
  onChange: (next: ProductTranslations) => void;
  original: { name: string; category: string; description: string };
  disabled?: boolean;
}) {
  const [active, setActive] = useState<ProductLocale>('en');

  const set = (locale: ProductLocale, field: keyof ProductTranslation, text: string) => onChange({ ...value, [locale]: { ...value[locale], [field]: text } });
  const filled = (locale: ProductLocale) => FIELDS.some((f) => (value[locale]?.[f] ?? '').trim() !== '');

  return (
    <div>
      <p className="text-sm text-pearl/55">
        Opcional. O texto digitado em “Dados do cristal” é o original; o que ficar em branco aqui usa o original. Preencha só o que muda de um idioma para outro.
      </p>

      <div role="tablist" aria-label="Idioma da tradução" className="glass mt-4 inline-flex gap-1 rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            title={tab.name}
            onClick={() => setActive(tab.key)}
            className={`relative rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${active === tab.key ? 'bg-gold-400 text-navy-950' : 'text-pearl/65 hover:text-pearl'}`}
          >
            {tab.label}
            {filled(tab.key) && <span aria-label="com tradução" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-gold-300 ring-2 ring-navy-900" />}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`tr-name-${active}`} className="label">Nome ({TABS.find((t) => t.key === active)?.name})</label>
          <input id={`tr-name-${active}`} className="field" maxLength={120} disabled={disabled} value={value[active]?.name ?? ''} onChange={(e) => set(active, 'name', e.target.value)} placeholder={original.name || 'Nome original'} />
        </div>
        <div>
          <label htmlFor={`tr-cat-${active}`} className="label">Categoria ({TABS.find((t) => t.key === active)?.name})</label>
          <input id={`tr-cat-${active}`} className="field" maxLength={60} disabled={disabled} value={value[active]?.category ?? ''} onChange={(e) => set(active, 'category', e.target.value)} placeholder={original.category || 'Categoria original'} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`tr-desc-${active}`} className="label">Descrição ({TABS.find((t) => t.key === active)?.name})</label>
          <textarea id={`tr-desc-${active}`} className="field min-h-28" maxLength={5000} disabled={disabled} value={value[active]?.description ?? ''} onChange={(e) => set(active, 'description', e.target.value)} placeholder={original.description || 'Descrição original'} />
        </div>
      </div>
    </div>
  );
}
