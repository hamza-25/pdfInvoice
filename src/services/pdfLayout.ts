/**
 * Shared layout constants for the invoice PDF.
 *
 * Keeping these in one place means the drawing code (controller) and any future
 * layout tweaks stay in sync, and the page-break maths has a single source of
 * truth.
 */
export const LAYOUT = {
  /** Page margin on every side. */
  margin: 50,

  /** Space reserved at the bottom of every page before a page break is forced. */
  bottomMargin: 55,

  columns: {
    /** Description column — descriptions wrap to this width. */
    description: { x: 55, width: 280 },
    quantity: { x: 350, width: 80 },
    amount: { x: 450, width: 100 },
  },

  row: {
    /** Space between the table header rule and the first row. */
    top: 10,
    /** Minimum height of a single row (a single line of text). */
    minHeight: 14,
    /** Extra vertical space added to a (wrapped) multi-line description. */
    paddingY: 4,
  },

  totals: {
    /** Vertical gap between the totals lines. */
    lineGap: 15,
    /** Space reserved for the tax / rule / total block (page-break check). */
    height: 70,
    /** Gap between the total line and the footer. */
    footerGap: 20,
    /** Space reserved for the footer block (page-break check). */
    footerHeight: 55,
  },

  /** Compact header repeated at the top of every page after the first. */
  continuation: {
    /** Height reserved above the table header on continuation pages. */
    height: 25,
  },

  /** Page-number footer stamped on every page. */
  footer: {
    /** Distance from the bottom edge of the page to the footer text. */
    fromBottom: 30,
  },
} as const;

import type { TranslationKey } from '../locales/en';

/** The three date/presentation families the PDF knows about. */
export type DocumentKind = 'invoice' | 'quote' | 'receipt';

/** How a document type is presented in the PDF header. */
export interface DocumentTypeStyle {
  /** Presentation family used by the invoice model to pick date roles. */
  kind: DocumentKind;
  /** Translation key of the big title in the top-right corner. */
  titleKey: TranslationKey;
  /** Accent color for the title and the underline rule. */
  accent: string;
  /** Translation key of the label in front of the document number. */
  idKey: TranslationKey;
  /** Translation key of the label in front of the primary date. */
  dateKey: TranslationKey;
  /** Payload field holding the primary date value (kept for compatibility). */
  dateField: 'issueDate' | 'dueDate';
}

/**
 * Presentation per document type. Keys are the exact `documentType` values
 * the form sends; anything unknown falls back to the invoice style.
 * Text is stored as translation keys — `t(key, language)` resolves it at
 * render time (chunk 5.2).
 */
export const DOCUMENT_TYPES: Record<string, DocumentTypeStyle> = {
  'SERVICE INVOICE': {
    kind: 'invoice',
    titleKey: 'pdf.invoice.title',
    accent: '#2563eb',
    idKey: 'pdf.invoice.idLabel',
    dateKey: 'pdf.date.invoice',
    dateField: 'issueDate',
  },
  'PRODUCT INVOICE': {
    kind: 'invoice',
    titleKey: 'pdf.invoice.title',
    accent: '#2563eb',
    idKey: 'pdf.invoice.idLabel',
    dateKey: 'pdf.date.invoice',
    dateField: 'issueDate',
  },
  QUOTE: {
    kind: 'quote',
    titleKey: 'pdf.quote.title',
    accent: '#d97706',
    idKey: 'pdf.quote.idLabel',
    dateKey: 'pdf.date.quote',
    dateField: 'dueDate',
  },
  RECEIPT: {
    kind: 'receipt',
    titleKey: 'pdf.receipt.title',
    accent: '#059669',
    idKey: 'pdf.receipt.idLabel',
    dateKey: 'pdf.date.receipt',
    dateField: 'issueDate',
  },
};

/** Resolve the style for a document type, falling back to a plain invoice. */
export const documentTypeStyle = (documentType: string): DocumentTypeStyle =>
  DOCUMENT_TYPES[documentType] ?? DOCUMENT_TYPES['SERVICE INVOICE'];
