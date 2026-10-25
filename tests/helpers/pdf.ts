import zlib from 'zlib';

/**
 * Extract readable text from a PDFKit-generated PDF buffer.
 *
 * PDFKit writes compressed content streams with text encoded as hex strings
 * inside `[<...>] TJ` operators. This inflates every stream and decodes the
 * hex tokens so tests can assert on the invoice's visible text.
 *
 * Streams are sliced by their declared `/Length` rather than by searching for
 * the `endstream` delimiter: compressed data can itself end with a CR/LF byte,
 * which a delimiter-based regex would strip and corrupt.
 */
export function extractPdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  const streams: Buffer[] = [];
  let index = 0;

  while ((index = raw.indexOf('stream', index)) !== -1) {
    // `indexOf('stream')` also matches the tail of `endstream`.
    if (raw.slice(index - 3, index) === 'end') {
      index += 'stream'.length;
      continue;
    }

    const newline = raw[index + 'stream'.length];
    const dataStart =
      newline === '\r' && raw[index + 'stream'.length + 1] === '\n'
        ? index + 'stream'.length + 2
        : newline === '\n'
          ? index + 'stream'.length + 1
          : -1;

    if (dataStart === -1) {
      index += 'stream'.length;
      continue;
    }

    // The nearest `<<...>>` before `stream` is this stream's dictionary.
    const dictStart = raw.lastIndexOf('<<', index);
    const dict = raw.slice(dictStart, index);
    const lengthMatch = /\/Length\s+(\d+)/.exec(dict);
    const dataEnd = lengthMatch
      ? dataStart + Number(lengthMatch[1])
      : raw.indexOf('endstream', dataStart);

    if (dataEnd > dataStart) {
      streams.push(pdf.subarray(dataStart, dataEnd));
    }
    const delimiter = raw.indexOf('endstream', dataEnd > dataStart ? dataEnd : index);
    index = delimiter === -1 ? raw.length : delimiter + 'endstream'.length;
  }

  let content = '';
  for (const bytes of streams) {
    try {
      content += zlib.inflateSync(bytes).toString('latin1') + '\n';
    } catch {
      content += bytes.toString('latin1') + '\n';
    }
  }

  const tokens = [...content.matchAll(/<([0-9A-Fa-f]+)>/g)].map((m) =>
    Buffer.from(m[1], 'hex').toString('latin1'),
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
