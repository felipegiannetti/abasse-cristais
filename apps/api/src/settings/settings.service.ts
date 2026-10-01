import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const invalidWhatsapp = () =>
  new BadRequestException({
    code: 'INVALID_WHATSAPP',
    message: 'Enter a valid WhatsApp number with country code (10 to 15 digits) or a wa.me link.',
  });

const invalidPhone = () =>
  new BadRequestException({
    code: 'INVALID_SMS_PHONE',
    message: 'Enter a valid phone number with country code (10 to 15 digits).',
  });

const invalidEmail = () =>
  new BadRequestException({ code: 'INVALID_EMAIL', message: 'Enter a valid email address.' });

/**
 * Turns whatever the admin pasted into digits only: "+55 (11) 99999-9999", "5511999999999" or a
 * "https://wa.me/5511999999999" link. Only the digits are stored — the site builds the wa.me link
 * itself, so an admin (or a stolen session) can never plant an arbitrary URL behind the WhatsApp buttons.
 */
export function normalizeWhatsapp(input: string): string {
  const raw = input.trim();
  if (raw === '') return ''; // empty = use the default from the environment

  let digits: string;
  if (/^https?:\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw invalidWhatsapp();
    }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw invalidWhatsapp();
    if (host === 'wa.me') digits = url.pathname.replace(/\D/g, '');
    else if (host === 'api.whatsapp.com' || host === 'web.whatsapp.com') digits = (url.searchParams.get('phone') ?? '').replace(/\D/g, '');
    else throw invalidWhatsapp(); // any other host is rejected outright
  } else {
    if (!/^[+\d\s().-]+$/.test(raw)) throw invalidWhatsapp();
    digits = raw.replace(/\D/g, '');
  }

  if (!/^[1-9]\d{9,14}$/.test(digits)) throw invalidWhatsapp();
  return digits;
}

/** Same digits-only rule as WhatsApp, but for a plain phone number (no wa.me link accepted). */
export function normalizePhone(input: string): string {
  const raw = input.trim();
  if (raw === '') return ''; // empty = hide the SMS button
  if (!/^[+\d\s().-]+$/.test(raw)) throw invalidPhone();
  const digits = raw.replace(/\D/g, '');
  if (!/^[1-9]\d{9,14}$/.test(digits)) throw invalidPhone();
  return digits;
}

// The WHATWG/HTML5 `input[type=email]` pattern: permissive enough for real addresses (plus-addressing,
// dots, hyphens), but the character classes exclude "<", ">", quotes and whitespace — unlike a loose
// "has an @ and a dot" check, this can't be filled with markup (e.g. "<script>...</script>@x.com").
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

/** Trims and lowercases; empty = hide the Email button. */
export function normalizeEmail(input: string): string {
  const raw = input.trim();
  if (raw === '') return '';
  if (raw.length > 254 || !EMAIL_RE.test(raw)) throw invalidEmail();
  return raw.toLowerCase();
}

// Languages the public site is translated into (see apps/web/src/i18n/config.ts — kept in sync by hand,
// there is no shared package between the two apps).
export const TEMPLATE_LOCALES = ['en', 'pt', 'es'] as const;
export type TemplateLocale = (typeof TEMPLATE_LOCALES)[number];

// One entry per message the site sends on the customer's behalf. Mirrors the {whatsapp,sms,email}
// sections of apps/web/src/i18n/messages/*.ts — an admin override replaces that dictionary string.
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

// Subject lines are one line in a mail client's header; everything else can be a full message body.
const SUBJECT_KEYS = new Set<TemplateKey>(['emailSubjectGeneral', 'emailSubjectProduct']);
const MAX_SUBJECT_LEN = 150;
const MAX_BODY_LEN = 2000;

export type TemplateOverrides = Partial<Record<TemplateKey, string>>;
export type TemplatesMap = Partial<Record<TemplateLocale, TemplateOverrides>>;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const invalidTemplates = (detail: string) =>
  new BadRequestException({ code: 'INVALID_TEMPLATES', message: `Invalid message templates: ${detail}` });

/**
 * Validates the admin's { locale: { key: text } } payload against the known locales/keys, trims each
 * string and enforces a length cap. An empty (or all-whitespace) value clears that override, so the
 * site falls back to its built-in default text — this never stores empty strings.
 */
export function normalizeTemplates(input: unknown): TemplatesMap {
  if (input === undefined) return {};
  if (!isPlainObject(input)) throw invalidTemplates('expected an object keyed by language.');

  const result: TemplatesMap = {};
  for (const [locale, value] of Object.entries(input)) {
    if (!(TEMPLATE_LOCALES as readonly string[]).includes(locale)) {
      throw invalidTemplates(`unknown language "${locale}".`);
    }
    if (!isPlainObject(value)) throw invalidTemplates(`"${locale}" must be an object keyed by field.`);

    const overrides: TemplateOverrides = {};
    for (const [key, text] of Object.entries(value)) {
      if (!(TEMPLATE_KEYS as readonly string[]).includes(key)) {
        throw invalidTemplates(`unknown field "${key}".`);
      }
      if (typeof text !== 'string') throw invalidTemplates(`"${locale}.${key}" must be a string.`);
      const trimmed = text.trim();
      const limit = SUBJECT_KEYS.has(key as TemplateKey) ? MAX_SUBJECT_LEN : MAX_BODY_LEN;
      if (trimmed.length > limit) {
        throw invalidTemplates(`"${locale}.${key}" is too long (max ${limit} characters).`);
      }
      if (trimmed) overrides[key as TemplateKey] = trimmed;
    }
    if (Object.keys(overrides).length > 0) result[locale as TemplateLocale] = overrides;
  }
  return result;
}

/** Reads whatever is stored in the Json column back into the validated shape, ignoring anything corrupt. */
function parseStoredTemplates(value: unknown): TemplatesMap {
  try {
    return normalizeTemplates(value);
  } catch {
    return {};
  }
}

export interface ContactSettings {
  whatsapp: string;
  sms: string;
  email: string;
  templates: TemplatesMap;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getContact(): Promise<ContactSettings> {
    const row = await this.prisma.siteSettings.findUnique({ where: { id: 'main' } });
    return {
      whatsapp: row?.whatsapp ?? '',
      sms: row?.sms ?? '',
      email: row?.email ?? '',
      templates: parseStoredTemplates(row?.messageTemplates),
    };
  }

  async updateContact(
    input: Partial<{ whatsapp: string; sms: string; email: string; templates: unknown }>,
    actorId: string,
  ): Promise<ContactSettings> {
    const data: { whatsapp?: string; sms?: string; email?: string; messageTemplates?: TemplatesMap } = {};
    if (input.whatsapp !== undefined) data.whatsapp = normalizeWhatsapp(input.whatsapp);
    if (input.sms !== undefined) data.sms = normalizePhone(input.sms);
    if (input.email !== undefined) data.email = normalizeEmail(input.email);
    // Whole-object replace (not a merge): the admin UI always sends its full, current template state.
    if (input.templates !== undefined) data.messageTemplates = normalizeTemplates(input.templates);

    const row = await this.prisma.siteSettings.upsert({
      where: { id: 'main' },
      update: data,
      create: { id: 'main', whatsapp: '', sms: '', email: '', messageTemplates: {}, ...data },
    });
    if (Object.keys(data).length > 0) {
      await this.audit.record({
        actorId,
        action: 'settings.update',
        entityType: 'Settings',
        summary: `Atualizou as configurações do site (${Object.keys(data).join(', ')})`,
      });
    }
    return {
      whatsapp: row.whatsapp,
      sms: row.sms,
      email: row.email,
      templates: parseStoredTemplates(row.messageTemplates),
    };
  }
}
