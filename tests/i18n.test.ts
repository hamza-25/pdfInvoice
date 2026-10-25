import { describe, it, expect } from 'vitest';
import { en, type TranslationKey } from '../src/locales/en';
import { fr } from '../src/locales/fr';
import { t, resolveLanguage, SUPPORTED_LANGUAGES } from '../src/services/i18n';

describe('translation dictionaries (chunk 5.1)', () => {
  it('defines exactly the same keys in EN and FR', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty strings in either dictionary', () => {
    for (const dict of [en, fr]) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value, `empty translation for "${key}"`).not.toBe('');
      }
    }
  });

  it('supports both languages, in UI order', () => {
    expect([...SUPPORTED_LANGUAGES]).toEqual(['en', 'fr']);
  });
});

describe('t() (chunk 5.1)', () => {
  it('returns the matching language string', () => {
    expect(t('pdf.receipt.title', 'fr')).toBe('REÇU');
    expect(t('pdf.receipt.title', 'en')).toBe('RECEIPT');
    expect(t('pdf.column.quantity', 'fr')).toBe('QTÉ');
    expect(t('pdf.column.quantity', 'en')).toBe('QTY');
    expect(t('pdf.column.unitPrice', 'fr')).toBe('PRIX UNITAIRE');
    expect(t('pdf.column.unitPrice', 'en')).toBe('UNIT PRICE');
    expect(t('pdf.subtotal', 'fr')).toBe('SOUS-TOTAL');
    expect(t('pdf.subtotal', 'en')).toBe('SUBTOTAL');
  });

  it('replaces {placeholder} params (page numbers)', () => {
    expect(t('pdf.pageOf', 'en', { current: 2, total: 3 })).toBe('Page 2 of 3');
    expect(t('pdf.pageOf', 'fr', { current: 2, total: 3 })).toBe('Page 2 sur 3');
  });

  it('resolveLanguage falls back to en for anything unknown', () => {
    expect(resolveLanguage('fr')).toBe('fr');
    expect(resolveLanguage('en')).toBe('en');
    expect(resolveLanguage('de')).toBe('en');
    expect(resolveLanguage(undefined)).toBe('en');
    expect(resolveLanguage({})).toBe('en');
  });

  it('never throws on a missing key — falls back to the key itself', () => {
    const missing = 'nope.key' as TranslationKey;
    expect(t(missing, 'fr')).toBe('nope.key');
  });
});
