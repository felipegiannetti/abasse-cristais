import { describe, expect, it } from 'vitest';
import { normalizeEmail, normalizePhone, normalizeWhatsapp } from './settings.service';

describe('normalizeWhatsapp', () => {
  it('empty string means "use the environment default"', () => {
    expect(normalizeWhatsapp('')).toBe('');
  });

  it('strips formatting from a typed number', () => {
    expect(normalizeWhatsapp('+55 (11) 99999-9999')).toBe('5511999999999');
  });

  it('extracts digits from a wa.me link', () => {
    expect(normalizeWhatsapp('https://wa.me/5511988887777')).toBe('5511988887777');
  });

  it('extracts the phone query param from an api.whatsapp.com link', () => {
    expect(normalizeWhatsapp('https://api.whatsapp.com/send?phone=5511977776666')).toBe('5511977776666');
  });

  it('rejects a link on any other host (no arbitrary URL behind the button)', () => {
    expect(() => normalizeWhatsapp('https://evil.example/5511999999999')).toThrow();
  });

  it('rejects fewer than 10 or more than 15 digits', () => {
    expect(() => normalizeWhatsapp('123')).toThrow();
    expect(() => normalizeWhatsapp('5511999999999999999')).toThrow();
  });

  it('rejects non-numeric, non-link input', () => {
    expect(() => normalizeWhatsapp('javascript:alert(1)')).toThrow();
  });
});

describe('normalizePhone', () => {
  it('empty string hides the SMS button', () => {
    expect(normalizePhone('')).toBe('');
  });

  it('strips formatting from a typed number', () => {
    expect(normalizePhone('+55 (11) 98888-7777')).toBe('5511988887777');
  });

  it('never accepts a wa.me-style link, unlike normalizeWhatsapp', () => {
    expect(() => normalizePhone('https://wa.me/5511999999999')).toThrow();
  });
});

describe('normalizeEmail', () => {
  it('empty string hides the email button', () => {
    expect(normalizeEmail('')).toBe('');
  });

  it('lowercases a valid address', () => {
    expect(normalizeEmail('Loja@AbasseCrystal.com')).toBe('loja@abassecrystal.com');
  });

  it('rejects markup disguised as an address', () => {
    expect(() => normalizeEmail('<script>alert(1)</script>@x.com')).toThrow();
  });

  it('rejects a bare non-email string', () => {
    expect(() => normalizeEmail('not-an-email')).toThrow();
  });

  it('rejects an address over 254 characters', () => {
    expect(() => normalizeEmail(`${'a'.repeat(250)}@x.com`)).toThrow();
  });
});
