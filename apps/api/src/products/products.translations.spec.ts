import { describe, expect, it } from 'vitest';
import { categoryLabels, localize, normalizeTranslations, readTranslations } from './products.translations';

describe('normalizeTranslations', () => {
  it('keeps known languages and fields, trims text and drops blanks', () => {
    expect(
      normalizeTranslations({
        en: { name: '  Amethyst Cluster ', description: '', category: 'Amethyst' },
        pt: { name: '   ' },
        es: { description: 'Drusa de amatista' },
      }),
    ).toEqual({ en: { name: 'Amethyst Cluster', category: 'Amethyst' }, es: { description: 'Drusa de amatista' } });
  });

  it('treats a null or undefined field like a blank one', () => {
    expect(normalizeTranslations({ en: { name: undefined, category: null, description: 'ok' } })).toEqual({ en: { description: 'ok' } });
  });

  it('treats null/undefined as no translations', () => {
    expect(normalizeTranslations(undefined)).toEqual({});
    expect(normalizeTranslations(null)).toEqual({});
    expect(normalizeTranslations({})).toEqual({});
  });

  it('rejects unknown languages, unknown fields, non-text values and bad shapes', () => {
    expect(() => normalizeTranslations({ fr: { name: 'x' } })).toThrow();
    expect(() => normalizeTranslations({ en: { slug: 'x' } })).toThrow();
    expect(() => normalizeTranslations({ en: { name: 5 } })).toThrow();
    expect(() => normalizeTranslations({ en: 'x' })).toThrow();
    expect(() => normalizeTranslations([])).toThrow();
    expect(() => normalizeTranslations('x')).toThrow();
  });

  it('enforces the same length limits as the product fields', () => {
    expect(() => normalizeTranslations({ en: { name: 'a'.repeat(121) } })).toThrow();
    expect(() => normalizeTranslations({ en: { category: 'a'.repeat(61) } })).toThrow();
    expect(() => normalizeTranslations({ en: { description: 'a'.repeat(5001) } })).toThrow();
    expect(normalizeTranslations({ en: { name: 'a'.repeat(120) } }).en?.name).toHaveLength(120);
  });

  it('is not fooled by prototype keys', () => {
    expect(() => normalizeTranslations(JSON.parse('{"__proto__":{"name":"x"}}'))).toThrow();
  });
});

describe('readTranslations', () => {
  it('returns {} for garbage instead of throwing', () => {
    expect(readTranslations('nope')).toEqual({});
    expect(readTranslations({ fr: {} })).toEqual({});
    expect(readTranslations({ en: { name: 'Hi' } })).toEqual({ en: { name: 'Hi' } });
  });
});

describe('localize', () => {
  const p = { name: 'Drusa de Ametista', description: 'Peça de presença.', category: 'Ametista', translations: { en: { name: 'Amethyst Cluster', category: 'Amethyst' } } };

  it('uses the translation where there is one and the original elsewhere', () => {
    expect(localize(p, 'en')).toEqual({ name: 'Amethyst Cluster', description: 'Peça de presença.', category: 'Amethyst' });
  });

  it('falls back to the original for a language without translations, or when no language is asked', () => {
    expect(localize(p, 'es')).toEqual({ name: 'Drusa de Ametista', description: 'Peça de presença.', category: 'Ametista' });
    expect(localize(p, undefined)).toEqual({ name: 'Drusa de Ametista', description: 'Peça de presença.', category: 'Ametista' });
  });
});

describe('categoryLabels', () => {
  it('picks the translated category from any product that has it', () => {
    const labels = categoryLabels(
      [
        { category: 'Ametista', translations: {} },
        { category: 'Ametista', translations: { en: { category: 'Amethyst' } } },
        { category: 'Quartzo', translations: {} },
      ],
      'en',
    );
    expect(labels.get('Ametista')).toBe('Amethyst');
    expect(labels.get('Quartzo')).toBe('Quartzo');
  });

  it('uses the category as typed when no language is asked', () => {
    expect(categoryLabels([{ category: 'Ametista', translations: { en: { category: 'Amethyst' } } }], undefined).get('Ametista')).toBe('Ametista');
  });
});
