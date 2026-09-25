import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const invalid = () =>
  new BadRequestException({
    code: 'INVALID_WHATSAPP',
    message: 'Enter a valid WhatsApp number with country code (10 to 15 digits) or a wa.me link.',
  });

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
      throw invalid();
    }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw invalid();
    if (host === 'wa.me') digits = url.pathname.replace(/\D/g, '');
    else if (host === 'api.whatsapp.com' || host === 'web.whatsapp.com') digits = (url.searchParams.get('phone') ?? '').replace(/\D/g, '');
    else throw invalid(); // any other host is rejected outright
  } else {
    if (!/^[+\d\s().-]+$/.test(raw)) throw invalid();
    digits = raw.replace(/\D/g, '');
  }

  if (!/^[1-9]\d{9,14}$/.test(digits)) throw invalid();
  return digits;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWhatsapp(): Promise<string> {
    const row = await this.prisma.siteSettings.findUnique({ where: { id: 'main' } });
    return row?.whatsapp ?? '';
  }

  async setWhatsapp(input: string): Promise<string> {
    const whatsapp = normalizeWhatsapp(input);
    await this.prisma.siteSettings.upsert({
      where: { id: 'main' },
      update: { whatsapp },
      create: { id: 'main', whatsapp },
    });
    return whatsapp;
  }
}
