import { BadRequestException } from '@nestjs/common';

/**
 * Per-product translations of the three texts a visitor reads: name, description and category.
 * The text typed in the product's own fields is the original; a translation that is missing or blank falls
 * back to it, so a product never shows an empty name in some language.
 */
export const TRANSLATION_LOCALES = ['en', 'pt', 'es'] as const;
export type TranslationLocale = (typeof TRANSLATION_LOCALES)[number];

export interface ProductTranslation {
  name?: string;
  description?: string;
  category?: string;
}
export type Translations = Partial<Record<TranslationLocale, ProductTranslation>>;

// same ceilings as the product's own fields (products.dto.ts)
const LIMITS = { name: 120, description: 5000, category: 60 } as const;
const FIELDS = Object.keys(LIMITS) as (keyof typeof LIMITS)[];

const invalid = (message: string) => new BadRequestException({ code: 'INVALID_TRANSLATIONS', message });
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Validates and cleans what the admin sent: only known languages and fields, strings only, trimmed, within the
 * length limits; blank values are dropped (blank = "use the original"). Anything else is a 400.
 */
export function normalizeTranslations(input: unknown): Translations {
  if (input === null || input === undefined) return {};
  if (!isRecord(input)) throw invalid('translations must be an object keyed by language.');
  const out: Translations = {};
  for (const [locale, entry] of Object.entries(input)) {
    if (!(TRANSLATION_LOCALES as readonly string[]).includes(locale)) throw invalid(`Unknown language "${locale}".`);
    if (!isRecord(entry)) throw invalid(`The translation for "${locale}" must be an object.`);
    const clean: ProductTranslation = {};
    for (const [field, value] of Object.entries(entry)) {
      if (!(FIELDS as string[]).includes(field)) throw invalid(`Unknown translation field "${field}".`);
      if (value === undefined || value === null) continue; // same as blank
      if (typeof value !== 'string') throw invalid(`"${locale}.${field}" must be text.`);
      const text = value.trim();
      if (text.length > LIMITS[field as keyof typeof LIMITS]) throw invalid(`"${locale}.${field}" is too long (max ${LIMITS[field as keyof typeof LIMITS]}).`);
      if (text) clean[field as keyof ProductTranslation] = text;
    }
    if (Object.keys(clean).length) out[locale as TranslationLocale] = clean;
  }
  return out;
}

/** What is stored in the JSON column, read defensively (it could hold anything an older version wrote). */
export function readTranslations(raw: unknown): Translations {
  try {
    return normalizeTranslations(raw);
  } catch {
    return {};
  }
}

/** The product's texts in `locale`, each falling back to the original when there is no translation. */
export function localize(
  p: { name: string; description: string; category: string; translations: unknown },
  locale: TranslationLocale | undefined,
): { name: string; description: string; category: string } {
  const t = locale ? readTranslations(p.translations)[locale] : undefined;
  return { name: t?.name ?? p.name, description: t?.description ?? p.description, category: t?.category ?? p.category };
}

/**
 * Display label of every category in `locale`: the translated category of any product in it (the first one
 * that has it), else the category as typed.
 */
export function categoryLabels(products: { category: string; translations: unknown }[], locale: TranslationLocale | undefined): Map<string, string> {
  const labels = new Map<string, string>();
  for (const p of products) {
    const label = locale ? readTranslations(p.translations)[locale]?.category : undefined;
    if (!labels.has(p.category) || (label && labels.get(p.category) === p.category)) labels.set(p.category, label ?? p.category);
  }
  return labels;
}
