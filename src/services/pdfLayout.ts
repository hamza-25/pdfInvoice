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
