import zlib from 'zlib';

/**
 * Extract readable text from a PDFKit-generated PDF buffer.
 *
 * PDFKit writes compressed content streams with text encoded as hex strings
 * inside `[<...>] TJ` operators. This inflates every stream and decodes the
 * hex tokens so tests can assert on the invoice's visible text.
 */
export function extractPdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  let content = '';

  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(raw)) !== null) {
    const bytes = Buffer.from(match[1], 'latin1');
    try {
      content += zlib.inflateSync(bytes).toString('latin1') + '\n';
    } catch {
      content += bytes.toString('latin1') + '\n';
    }
  }

  const tokens = [...content.matchAll(/<([0-9A-Fa-f]+)>/g)].map((m) =>
    Buffer.from(m[1], 'hex').toString('latin1')
  );
  return tokens.join('');
}

/** True when the PDF starts with the `%PDF` magic bytes. */
export function isPdf(pdf: Buffer): boolean {
  return pdf.subarray(0, 4).toString('latin1') === '%PDF';
}

/**
 * Count the page objects in a PDF. Object dictionaries are stored uncompressed,
 * so `/Type /Page` appears once per page (`/Type /Pages` is the page tree and is
 * excluded by the word boundary).
 */
export function countPdfPages(pdf: Buffer): number {
  const raw = pdf.toString('latin1');
  return (raw.match(/\/Type\s*\/Page\b/g) ?? []).length;
}
