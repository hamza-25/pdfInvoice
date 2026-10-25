import type { TranslationKey } from '../locales/en';

/** Page grid, in PostScript points (A4). */
export const PAGE = {
  width: 595.28,
  height: 841.89,
  /** Left/right/top margin. */
  margin: 56,
  /** Space reserved below the content for the page-number footer. */
  footerReserved: 40,
  /** Usable width between the left and right margins. */
  contentWidth: 483.28,
} as const;

/** Paper-and-ink palette, mirrored from `src/styles/app.css`. */
export const COLORS = {
  paper: '#FFFFFF',
  ink: '#1A1F26',
  inkSoft: '#5C6673',
  rule: '#E5E3DC',
  accent: '#9E2B25',
} as const;

/** Standard PDFKit faces. P9 can swap these for embedded TTFs. */
export const FONTS = {
  display: 'Times-Bold',
  sans: 'Helvetica',
  sansBold: 'Helvetica-Bold',
} as const;

/** Type scale for the document. Sizes are points; leading is line height. */
export const TYPE = {
  title: { font: FONTS.display, size: 30, leading: 32, tracking: 0.6 },
  company: { font: FONTS.sansBold, size: 12, leading: 15 },
  client: { font: FONTS.sansBold, size: 10.5, leading: 14 },
  sectionLabel: { font: FONTS.sansBold, size: 7.5, leading: 9, tracking: 1.2 },
  metaLabel: { font: FONTS.sansBold, size: 7.5, leading: 9, tracking: 0.9 },
  metaValue: { font: FONTS.sans, size: 9, leading: 11 },
  tableHeader: { font: FONTS.sansBold, size: 7.5, leading: 9, tracking: 0.8 },
  tableBody: { font: FONTS.sans, size: 9, leading: 12 },
  grandTotal: { font: FONTS.sansBold, size: 13, leading: 15 },
  footer: { font: FONTS.sans, size: 7.5, leading: 10 },
} as const;

/** Vertical rhythm scale. */
export const SPACE = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Five-column items table (P3). x is absolute; amounts are right-aligned. */
export const COLUMNS = {
  index: { x: 56, width: 20, align: 'left' },
  description: { x: 84, width: 220, align: 'left' },
  quantity: { x: 312, width: 36, align: 'right' },
  unitPrice: { x: 360, width: 76, align: 'right' },
  amount: { x: 448, width: 91.28, align: 'right' },
} as const;

/** Height of the subtotal and tax rows. */
const TOTALS_ROW_HEIGHT = 18;
/** Height of the grand-total row. */
const TOTALS_TOTAL_HEIGHT = 22;

/**
 * Right-aligned totals ledger (P4): subtotal, tax, rule, grand total.
 * `height` is reserved before drawing so the ledger never splits a page.
 */
export const TOTALS = {
  /** Block width; right-aligned to the content edge. */
  width: 210,
  /** Gap between the last table row and the first ledger row. */
  gap: SPACE.lg,
  rowHeight: TOTALS_ROW_HEIGHT,
  /** Gap between the tax row and the rule above TOTAL. */
  ruleGap: SPACE.sm,
  /** Gap between the rule and the grand-total row. */
  totalGap: SPACE.sm,
  totalHeight: TOTALS_TOTAL_HEIGHT,
  /** Total height reserved by `ensureSpace` before drawing. */
  height: SPACE.lg + TOTALS_ROW_HEIGHT * 2 + SPACE.sm * 2 + TOTALS_TOTAL_HEIGHT,
} as const;

/**
 * Legacy footer constants still used until P5 replaces the closing block.
 */
export const LAYOUT = {
  /** Page margin on every side. */
  margin: PAGE.margin,

  totals: {
    /** Gap between the total line and the footer. */
    footerGap: 20,
    /** Space reserved for the footer block (page-break check). */
    footerHeight: 55,
  },

  /** Page-number footer stamped on every page. */
  footer: {
    /** Distance from the bottom edge of the page to the footer text. */
    fromBottom: 30,
  },
} as const;

/** The three date/presentation families the PDF knows about. */
export type DocumentKind = 'invoice' | 'quote' | 'receipt';

/** How a document type is presented in the PDF header. */
export interface DocumentTypeStyle {
  /** Presentation family used by the invoice model to pick date roles. */
  kind: DocumentKind;
  /** Translation key of the big title in the top-right corner. */
  titleKey: TranslationKey;
  /** Translation key of the label in front of the document number. */
  idKey: TranslationKey;
  /** Translation key of the primary date label. */
  dateKey: TranslationKey;
}

/**
 * Presentation per document type. Keys are the exact `documentType` values
 * the form sends; anything unknown falls back to the invoice style.
 * Text is stored as translation keys — `t(key, language)` resolves it at
 * render time.
 */
export const DOCUMENT_TYPES: Record<string, DocumentTypeStyle> = {
  'SERVICE INVOICE': {
    kind: 'invoice',
    titleKey: 'pdf.invoice.title',
    idKey: 'pdf.invoice.idLabel',
    dateKey: 'pdf.date.invoice',
  },
  'PRODUCT INVOICE': {
    kind: 'invoice',
    titleKey: 'pdf.invoice.title',
    idKey: 'pdf.invoice.idLabel',
    dateKey: 'pdf.date.invoice',
  },
  QUOTE: {
    kind: 'quote',
    titleKey: 'pdf.quote.title',
    idKey: 'pdf.quote.idLabel',
    dateKey: 'pdf.date.quote',
  },
  RECEIPT: {
    kind: 'receipt',
    titleKey: 'pdf.receipt.title',
    idKey: 'pdf.receipt.idLabel',
    dateKey: 'pdf.date.receipt',
  },
};

/** Resolve the style for a document type, falling back to a plain invoice. */
export const documentTypeStyle = (documentType: string): DocumentTypeStyle =>
  DOCUMENT_TYPES[documentType] ?? DOCUMENT_TYPES['SERVICE INVOICE'];
