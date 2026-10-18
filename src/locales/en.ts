/**
 * English translation dictionary — the source of truth for translation keys.
 *
 * Keys are flat and dotted: lookups stay fully typed, EN/FR parity is easy to
 * test, and the whole dictionary can be serialized to the browser as JSON
 * (chunk 5.3). Chunk 5.3 adds UI keys, 5.4 adds API error keys.
 */
export interface Dictionary {
  // Document types (big title + label in front of the document number)
  'pdf.invoice.title': string;
  'pdf.invoice.idLabel': string;
  'pdf.quote.title': string;
  'pdf.quote.idLabel': string;
  'pdf.receipt.title': string;
  'pdf.receipt.idLabel': string;

  // Date label per document type
  'pdf.date.invoice': string;
  'pdf.date.quote': string;
  'pdf.date.receipt': string;

  // Invoice layout
  'pdf.billTo': string;
  'pdf.column.description': string;
  'pdf.column.quantity': string;
  'pdf.column.amount': string;
  'pdf.tax': string; // rendered as "<tax> (<rate>%)"
  'pdf.total': string;
  'pdf.thanks': string;
  'pdf.contactNote': string;
  'pdf.pageOf': string; // {current} / {total} placeholders
}

/** Every valid translation key. */
export type TranslationKey = keyof Dictionary;

export const en: Dictionary = {
  'pdf.invoice.title': 'INVOICE',
  'pdf.invoice.idLabel': 'INVOICE #',
  'pdf.quote.title': 'QUOTE',
  'pdf.quote.idLabel': 'QUOTE #',
  'pdf.receipt.title': 'RECEIPT',
  'pdf.receipt.idLabel': 'RECEIPT #',
  'pdf.date.invoice': 'DATE',
  'pdf.date.quote': 'VALID UNTIL',
  'pdf.date.receipt': 'PAID ON',
  'pdf.billTo': 'BILL TO',
  'pdf.column.description': 'DESCRIPTION',
  'pdf.column.quantity': 'Quantity',
  'pdf.column.amount': 'AMOUNT',
  'pdf.tax': 'Tax',
  'pdf.total': 'TOTAL',
  'pdf.thanks': 'Thank you for your business!',
  'pdf.contactNote': 'If you have any questions about this invoice, please contact Us',
  'pdf.pageOf': 'Page {current} of {total}',
};
