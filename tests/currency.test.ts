import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate, CURRENCY_STYLES } from '../src/services/currency';

describe('formatMoney (chunk 4.6)', () => {
  it('formats USD with en-US separators and the $ symbol', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('1,234.50 $');
    expect(formatMoney(0, 'USD')).toBe('0.00 $');
  });

  it('formats MAD with fr-MA separators and the dh symbol', () => {
    expect(formatMoney(1234.5, 'MAD')).toBe('1.234,50 dh'); // fr-MA groups with '.'
  });

  it('formats EUR with de-DE separators', () => {
    expect(formatMoney(1234.5, 'EUR')).toBe('1.234,50 €');
  });

  it('gives JPY zero fractional digits', () => {
    expect(formatMoney(1234.6, 'JPY')).toBe('1,235 ¥'); // rounds to whole yen
    expect(formatMoney(1234, 'JPY')).toBe('1,234 ¥');
  });

  it('formats GBP with en-GB', () => {
    expect(formatMoney(1234.5, 'GBP')).toBe('1,234.50 £');
  });

  it('falls back to the code as symbol for unknown codes', () => {
    expect(formatMoney(10, 'XYZ')).toBe('10.00 XYZ');
  });
});

describe('formatDate (chunk 4.6)', () => {
  it('formats ISO dates in the currency locale', () => {
    expect(formatDate('2026-02-15', 'USD')).toBe('February 15, 2026');
    expect(formatDate('2026-02-15', 'EUR')).toBe('15. Februar 2026');
  });

  it('returns empty string for missing dates and the raw string for non-ISO input', () => {
    expect(formatDate(undefined, 'USD')).toBe('');
    expect(formatDate('next week', 'USD')).toBe('next week');
  });

  it('degrades ja-JP long dates to an encodable short form (WinAnsi fonts)', () => {
    // long: "2026年11月30日" — CJK glyphs PDFKit's standard fonts cannot encode
    expect(formatDate('2026-11-30', 'JPY')).toBe('2026/11/30');
  });

  it('does not shift the day across timezones (UTC-safe parse)', () => {
    expect(formatDate('2026-01-01', 'USD')).toBe('January 1, 2026');
  });
});

describe('CURRENCY_STYLES', () => {
  it('uses only PDF-safe (WinAnsi) symbols', () => {
    // printable ASCII, or the WinAnsi specials: € (0x80), £ (0xA3), ¥ (0xA5).
    // € is NOT latin1-encodable, so a latin1 round-trip is not the right check.
    const winAnsiSafe = /^[\x20-\x7E€£¥]+$/;
    for (const { symbol } of Object.values(CURRENCY_STYLES)) {
      expect(symbol).toMatch(winAnsiSafe);
    }
  });

  it('has a style for every currency the form can send', () => {
    expect(Object.keys(CURRENCY_STYLES).sort()).toEqual(['EUR', 'GBP', 'JPY', 'MAD', 'USD']);
  });
});
