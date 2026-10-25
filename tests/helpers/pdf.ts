import { en } from '../../src/locales/en';
import { fr } from '../../src/locales/fr';

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

type EsmImporter = (specifier: string) => Promise<unknown>;

/**
 * Native dynamic import. Vitest rewrites this itself, which is required inside
 * its module VM: code compiled with `new Function` has no dynamic-import
 * callback there (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`).
 */
const nativeImport: EsmImporter = (specifier) => import(specifier);

/**
 * `ts-node` compiles this helper to CommonJS, which would turn a normal
 * dynamic import into `require()`; PDF.js is ESM-only. Keep the native import
 * so the sample script also runs on Node 20.
 */
const vmImport: EsmImporter = (specifier) =>
  new Function('specifier', 'return import(specifier)')(specifier) as Promise<unknown>;

/** Prefer Vitest's importer; use the `new Function` shim for the CJS sample run. */
const importEsm: EsmImporter = process.env.VITEST ? nativeImport : vmImport;

let pdfJs: Promise<PdfJsModule> | undefined;

/** Load PDF.js lazily so test collection does not pay for its parser. */
const loadPdfJs = (): Promise<PdfJsModule> =>
  (pdfJs ??= importEsm('pdfjs-dist/legacy/build/pdf.mjs') as Promise<PdfJsModule>);

const compact = (text: string): string => text.replace(/\s+/g, '');

/**
 * Tracked labels are drawn with `characterSpacing`; PDF.js represents those
 * gaps as spaces ("I N VO I C E #"), while the old extractor concatenated hex
 * tokens ("INVOICE #"). Map the compacted label back to its dictionary form so
 * assertions keep reading like the invoice.
 */
const pdfLabels = new Map<string, string>();
for (const dictionary of [en, fr]) {
  for (const [key, value] of Object.entries(dictionary)) {
    if (key.startsWith('pdf.') && !value.includes('{')) {
      pdfLabels.set(compact(value), value);
    }
  }
}

const normalizeTrackedLabel = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  const hasColon = trimmed.endsWith(':');
  const compactLabel = compact(hasColon ? trimmed.slice(0, -1) : trimmed);
  const label = pdfLabels.get(compactLabel);
  return label ? `${label}${hasColon ? ':' : ''}` : text;
};

/**
 * Extract visible text from a PDFKit-generated PDF buffer.
 *
 * PDF.js understands embedded font subsets through their ToUnicode maps, so
 * this works for both the bundled IBM Plex/Spectral faces and the
 * Helvetica/Times fallback. Text items are concatenated in stream order, which
 * preserves the old helper's behaviour (column gaps are not inserted).
 */
export async function extractPdfText(pdf: Buffer): Promise<string> {
  const { getDocument } = await loadPdfJs();
  const loadingTask = getDocument({
    data: new Uint8Array(pdf),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  });

  const document = await loadingTask.promise;
  try {
    let text = '';
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ('str' in item && item.str.trim()) {
          text += normalizeTrackedLabel(item.str);
        }
      }
    }
    return text;
  } finally {
    await document.destroy();
  }
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
