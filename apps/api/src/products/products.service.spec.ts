import { describe, expect, it } from 'vitest';
import { slugify } from './products.service';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Drusa de Ametista')).toBe('drusa-de-ametista');
  });

  it('strips accents', () => {
    expect(slugify('Ágata Azul')).toBe('agata-azul');
  });

  it('collapses runs of non-alphanumeric characters into a single hyphen', () => {
    expect(slugify('Quartzo  --  Rosa!!')).toBe('quartzo-rosa');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -Cristal-  ')).toBe('cristal');
  });

  it('caps the length at 80 characters', () => {
    expect(slugify('a'.repeat(200)).length).toBe(80);
  });

  it('falls back to "cristal" when nothing alphanumeric survives', () => {
    expect(slugify('!!!')).toBe('cristal');
  });
});
