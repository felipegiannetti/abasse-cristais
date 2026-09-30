import { BadRequestException, Injectable } from '@nestjs/common';
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

export interface ContactSettings {
  whatsapp: string;
  sms: string;
  email: string;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getContact(): Promise<ContactSettings> {
    const row = await this.prisma.siteSettings.findUnique({ where: { id: 'main' } });
    return { whatsapp: row?.whatsapp ?? '', sms: row?.sms ?? '', email: row?.email ?? '' };
  }

  async updateContact(input: Partial<ContactSettings>): Promise<ContactSettings> {
    const data: Partial<ContactSettings> = {};
    if (input.whatsapp !== undefined) data.whatsapp = normalizeWhatsapp(input.whatsapp);
    if (input.sms !== undefined) data.sms = normalizePhone(input.sms);
    if (input.email !== undefined) data.email = normalizeEmail(input.email);

    const row = await this.prisma.siteSettings.upsert({
      where: { id: 'main' },
      update: data,
      create: { id: 'main', whatsapp: '', sms: '', email: '', ...data },
    });
    return { whatsapp: row.whatsapp, sms: row.sms, email: row.email };
  }
}
