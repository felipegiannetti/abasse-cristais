'use client';

import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { site } from '@/content/site';
import { fmt, locales, type Locale } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { defaultTemplate, TEMPLATE_KEYS, type TemplateKey, type TemplatesMap } from '@/i18n/templates';
import { IconEdit } from './AdminIcons';

const LOCALE_LABEL: Record<Locale, string> = { en: 'English', pt: 'Português', es: 'Español' };
// Text-substitution fields ({name}/{price}/{url}) vs. brand-only ones, so the hint under each field
// and the sample data used for the preview only mention the tokens that field actually supports.
const PRODUCT_FIELDS = new Set<TemplateKey>(['whatsappProduct', 'smsProduct', 'emailSubjectProduct', 'emailProduct']);
const SUBJECT_FIELDS = new Set<TemplateKey>(['emailSubjectGeneral', 'emailSubjectProduct']);
const GROUPS: { key: 'groupWhatsapp' | 'groupSms' | 'groupEmail'; fields: TemplateKey[] }[] = [
  { key: 'groupWhatsapp', fields: ['whatsappGeneral', 'whatsappProduct'] },
  { key: 'groupSms', fields: ['smsGeneral', 'smsProduct'] },
  { key: 'groupEmail', fields: ['emailSubjectGeneral', 'emailSubjectProduct', 'emailGeneral', 'emailProduct'] },
];

// Sample data for the live preview — a stand-in product, always shown in this shape regardless of
// which language tab is open (it's just an example, not real copy).
const SAMPLE = { name: 'Drusa de Ametista', price: 'R$ 249,90', url: `${site.url}/products/drusa-de-ametista` };

interface Props {
  templates: TemplatesMap;
  onChange: (next: TemplatesMap) => void;
  disabled?: boolean;
}

export function MessageTemplatesCard({ templates, onChange, disabled }: Props) {
  const { m } = useI18n();
  const t = m.admin.settingsPage.messages;
  const [lang, setLang] = useState<Locale>('en');

  const current = templates[lang] ?? {};

  function setField(key: TemplateKey, value: string) {
    const nextForLocale = { ...current, [key]: value };
    onChange({ ...templates, [lang]: nextForLocale });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass-strong gold-border rounded-[2rem] p-7 sm:p-9"
    >
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-600 text-navy-950">
          <IconEdit className="h-7 w-7" />
        </span>
        <div>
          <h2 className="font-display text-3xl text-pearl">{t.title}</h2>
        </div>
      </div>
      <p className="mt-5 text-sm leading-relaxed text-pearl/60">{t.help}</p>

      <div role="tablist" aria-label={t.languageLabel} className="mt-6 flex gap-2">
        {locales.map((l) => {
          const dirty = Object.keys(templates[l] ?? {}).length > 0;
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={l === lang}
              onClick={() => setLang(l)}
              className={`relative rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                l === lang ? 'border-gold-400 bg-gold-400/15 text-gold-300' : 'border-white/12 text-pearl/70 hover:border-gold-400/50 hover:text-pearl'
              }`}
            >
              {LOCALE_LABEL[l]}
              {dirty && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-gold-400" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="mt-6 space-y-8">
        {GROUPS.map((group) => (
          <div key={group.key}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-300/80">{t[group.key]}</h3>
            <div className="mt-3 space-y-5">
              {group.fields.map((key) => (
                <TemplateField
                  key={`${lang}-${key}`}
                  locale={lang}
                  fieldKey={key}
                  value={current[key] ?? ''}
                  onChange={(v) => setField(key, v)}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function TemplateField({
  locale,
  fieldKey,
  value,
  onChange,
  disabled,
}: {
  locale: Locale;
  fieldKey: TemplateKey;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { m } = useI18n();
  const t = m.admin.settingsPage.messages;
  const field = t.fields[fieldKey];
  const isSubject = SUBJECT_FIELDS.has(fieldKey);
  const isProduct = PRODUCT_FIELDS.has(fieldKey);
  const maxLength = isSubject ? 150 : 2000;
  const id = `tpl-${locale}-${fieldKey}`;

  const fallback = useMemo(() => defaultTemplate(locale, fieldKey), [locale, fieldKey]);
  const tokens = isProduct ? '{brand}, {name}, {price}, {url}' : '{brand}';
  const preview = useMemo(
    () => fmt(value || fallback, { brand: site.name, ...SAMPLE }),
    [value, fallback],
  );

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label !mb-1">
          {field.label}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={disabled}
            className="text-xs font-medium text-gold-300 hover:text-gold-200 disabled:opacity-40"
          >
            {t.reset}
          </button>
        )}
      </div>
      <p className="mb-2 text-xs text-pearl/45">{field.hint}</p>
      {isSubject ? (
        <input
          id={id}
          className="field"
          value={value}
          maxLength={maxLength}
          placeholder={fallback}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <textarea
          id={id}
          className="field min-h-24 resize-y"
          value={value}
          maxLength={maxLength}
          placeholder={fallback}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-pearl/40">
        <span>
          {t.placeholders} <code className="text-pearl/60">{tokens}</code>
        </span>
        <span>
          {value.length}/{maxLength}
        </span>
      </div>
      <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-pearl/35">{t.previewLabel}</p>
        <p className="mt-1 whitespace-pre-line text-sm text-pearl/75">{preview}</p>
      </div>
    </div>
  );
}
