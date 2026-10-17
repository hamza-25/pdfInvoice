let sequence = 0;

/**
 * Returns a short, human-readable invoice number, e.g. `INV-2026-0001`.
 *
 * Uses an in-process counter, so two consecutive requests always differ. (A
 * persistent store would be needed for restart-safe uniqueness.)
 */
export const generateInvoiceNumber = (date: Date = new Date()): string => {
  sequence += 1;
  const year = date.getFullYear();
  return `INV-${year}-${String(sequence).padStart(4, '0')}`;
};
