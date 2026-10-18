/** Presentation of a currency for the PDF (WinAnsi-safe symbol) and Intl. */
export interface CurrencyStyle {
  /** Symbol safe to render with PDFKit's standard fonts. */
  symbol: string;
  /** BCP 47 locale driving separators, digit grouping and date wording. */
  locale: string;
}

/**
 * Supported currencies. The symbol is what the PDF shows (PDFKit's standard
 * fonts are WinAnsi — `€`, `¥`, `£` are fine, full-width `￥` is not); the
 * locale drives separators and date formatting.
 */
export const CURRENCY_STYLES: Record<string, CurrencyStyle> = {
  USD: { symbol: '$', locale: 'en-US' },
  MAD: { symbol: 'dh', locale: 'fr-MA' },
  EUR: { symbol: '€', locale: 'de-DE' },
  JPY: { symbol: '¥', locale: 'ja-JP' },
  GBP: { symbol: '£', locale: 'en-GB' },
};

/** Unknown codes fall back to the code itself as the symbol. */
const styleFor = (currencyCode: string): CurrencyStyle =>
  CURRENCY_STYLES[currencyCode] ?? { symbol: currencyCode || '', locale: 'en-US' };

/** Fraction digits Intl assigns to a currency (JPY has 0, most have 2). */
const fractionDigitsFor = (currencyCode: string, locale: string): number => {
  try {
    return (
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2; // unknown currency code — Intl throws RangeError
  }
};

/**
 * Normalize space variants: Intl uses no-break (U+00A0) spaces for grouping
 * and sometimes narrow/thin spaces — the PDF should render and extract them
 * as regular spaces.
 */
const toPdfSafe = (text: string): string => text.replace(/[\u00A0\u202F\u2009]/g, ' ');

/**
 * Format a money amount for the PDF: locale-aware separators and grouping,
 * currency-correct fraction digits (JPY gets none) and a PDF-safe symbol.
 * e.g. 1234.5 + USD -> "1,234.50 $", 1234.5 + MAD -> "1 234,50 dh".
 */
export const formatMoney = (amount: number, currencyCode: string): string => {
  const { symbol, locale } = styleFor(currencyCode);
  const digits = fractionDigitsFor(currencyCode, locale);
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  return toPdfSafe(`${number} ${symbol}`);
};

/**
 * True when every character can be rendered by PDFKit's standard fonts
 * (WinAnsi = latin1 plus a few cp1252 extras like €). ja-JP dates produce
 * CJK characters ("2026年11月30日") that those fonts cannot encode.
 */
const isWinAnsiSafe = (text: string): boolean =>
  [...text].every((ch) => (ch.codePointAt(0) ?? 0) <= 0xff || ch === '€');

/**
 * Format an ISO date (YYYY-MM-DD) for the PDF in the currency's locale,
 * e.g. 2026-02-15 + EUR -> "15. Februar 2026". Degrades from `long` to
 * `short` (ja-JP: "2026/11/30") when the long form is not encodable, and
 * finally to the raw string; non-ISO input is printed as given.
 */
export const formatDate = (isoDate: string | undefined, currencyCode: string): string => {
  if (!isoDate) {
    return '';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    return isoDate;
  }
  const [, year, month, day] = match;
  const { locale } = styleFor(currencyCode);
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  for (const dateStyle of ['long', 'short'] as const) {
    const formatted = new Intl.DateTimeFormat(locale, { dateStyle, timeZone: 'UTC' }).format(date);
    if (isWinAnsiSafe(formatted)) {
      return formatted;
    }
  }
  return isoDate; // nothing renderable — show the ISO date
};
