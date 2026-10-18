/**
 * Sanitizer for text destined for a PDF.
 *
 * PDF text is not HTML: escaping it (`O'Brien` → `O&#39;Brien`) corrupts
 * legitimate input without protecting anything. The real hazards for a PDF
 * are control characters (which PDFKit may reject or render as garbage), so
 * those are stripped. Newlines and tabs are preserved - they are meaningful
 * in a document.
 */
export const stripControlChars = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  // C0 controls except \n and \t, DEL, and the C1 range.
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
};
