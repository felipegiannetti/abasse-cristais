import { getPublicMessages, type Messages } from '@/i18n';
import type { Locale } from './config';

// One entry per message the site sends on the customer's behalf. Mirrors the {whatsapp,sms,email}
// sections of apps/web/src/i18n/messages/*.ts (kept in sync with apps/api/src/settings/settings.service.ts
// by hand — there is no shared package between the two apps).
export const TEMPLATE_KEYS = [
  'whatsappGeneral',
  'whatsappProduct',
  'smsGeneral',
  'smsProduct',
  'emailSubjectGeneral',
  'emailSubjectProduct',
  'emailGeneral',
  'emailProduct',
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export type TemplateOverrides = Partial<Record<TemplateKey, string>>;
export type TemplatesMap = Partial<Record<Locale, TemplateOverrides>>;

/** The site's built-in text for a template field, before any admin customization. */
export function defaultTemplate(locale: Locale, key: TemplateKey): string {
  const m = getPublicMessages(locale);
  switch (key) {
    case 'whatsappGeneral':
      return m.whatsapp.general;
    case 'whatsappProduct':
      return m.whatsapp.product;
    case 'smsGeneral':
      return m.sms.general;
    case 'smsProduct':
      return m.sms.product;
    case 'emailSubjectGeneral':
      return m.email.subjectGeneral;
    case 'emailSubjectProduct':
      return m.email.subjectProduct;
    case 'emailGeneral':
      return m.email.general;
    case 'emailProduct':
      return m.email.product;
  }
}

/**
 * Returns a NEW messages object with any admin-customized template text merged in — never mutates
 * `messages` (it's the shared, module-level dictionary; every request for this locale reuses it).
 */
export function applyTemplateOverrides(messages: Messages, overrides: TemplateOverrides | undefined): Messages {
  if (!overrides || Object.keys(overrides).length === 0) return messages;

  const whatsapp = { ...messages.whatsapp };
  const sms = { ...messages.sms };
  const email = { ...messages.email };
  if (overrides.whatsappGeneral) whatsapp.general = overrides.whatsappGeneral;
  if (overrides.whatsappProduct) whatsapp.product = overrides.whatsappProduct;
  if (overrides.smsGeneral) sms.general = overrides.smsGeneral;
  if (overrides.smsProduct) sms.product = overrides.smsProduct;
  if (overrides.emailSubjectGeneral) email.subjectGeneral = overrides.emailSubjectGeneral;
  if (overrides.emailSubjectProduct) email.subjectProduct = overrides.emailSubjectProduct;
  if (overrides.emailGeneral) email.general = overrides.emailGeneral;
  if (overrides.emailProduct) email.product = overrides.emailProduct;

  return { ...messages, whatsapp, sms, email };
}
