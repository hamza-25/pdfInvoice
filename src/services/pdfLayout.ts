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
} as const;

/** How a document type is presented in the PDF header. */
export interface DocumentTypeStyle {
  /** Big title in the top-right corner. */
  title: string;
  /** Accent color for the title and the underline rule. */
  accent: string;
  /** Label in front of the document number (e.g. "INVOICE #"). */
  idLabel: string;
  /** Label in front of the primary date. */
  dateLabel: string;
  /** Payload field holding the primary date value. */
  dateField: 'issueDate' | 'dueDate';
}

/**
 * Presentation per document type. Keys are the exact `documentType` values
 * the form sends; anything unknown falls back to the invoice style.
 */
export const DOCUMENT_TYPES: Record<string, DocumentTypeStyle> = {
  'SERVICE INVOICE': {
    title: 'INVOICE',
    accent: '#2563eb',
    idLabel: 'INVOICE #',
    dateLabel: 'DATE',
    dateField: 'issueDate',
  },
  'PRODUCT INVOICE': {
    title: 'INVOICE',
    accent: '#2563eb',
    idLabel: 'INVOICE #',
    dateLabel: 'DATE',
    dateField: 'issueDate',
  },
  QUOTE: {
    title: 'QUOTE',
    accent: '#d97706',
    idLabel: 'QUOTE #',
    dateLabel: 'VALID UNTIL',
    dateField: 'dueDate',
  },
  RECEIPT: {
    title: 'RECEIPT',
    accent: '#059669',
    idLabel: 'RECEIPT #',
    dateLabel: 'PAID ON',
    dateField: 'issueDate',
  },
};

/** Resolve the style for a document type, falling back to a plain invoice. */
export const documentTypeStyle = (documentType: string): DocumentTypeStyle =>
  DOCUMENT_TYPES[documentType] ?? DOCUMENT_TYPES['SERVICE INVOICE'];
