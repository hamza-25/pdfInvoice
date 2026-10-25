import fs from 'node:fs';
import path from 'node:path';
import { FONTS } from './pdfLayout';

/**
 * Embedded faces used by the PDF, keyed by the layout token that selects them.
 * The TTFs are subset by PDFKit, so only the glyphs used in a document are
 * written to the PDF.
 */
const FONT_FILES: Record<keyof typeof FONTS, string> = {
  display: 'Spectral-SemiBold.ttf',
  sans: 'IBMPlexSans-Regular.ttf',
  sansMedium: 'IBMPlexSans-Medium.ttf',
  sansBold: 'IBMPlexSans-SemiBold.ttf',
};

/** Standard-font aliases keep the document usable if an asset is unavailable. */
const FALLBACK_FONTS: Record<keyof typeof FONTS, string> = {
  display: 'Times-Bold',
  sans: 'Helvetica',
  sansMedium: 'Helvetica',
  sansBold: 'Helvetica-Bold',
};

export interface RegisterPdfFontsOptions {
  /** Limit lookup to one directory; mainly useful for the fallback test. */
  fontDir?: string;
}

/**
 * Resolve a font file next to the source tree or in the runtime image.
 *
 * `__dirname` points at `src/services` in development and `dist/services` in a
 * compiled build. The runtime Docker image copies `src/assets/fonts`, so the
 * working-directory fallback covers `npm start` / the container.
 */
const fontPath = (fileName: string, fontDir?: string): string | undefined => {
  const candidates = fontDir
    ? [fontDir]
    : [path.resolve(__dirname, '../assets/fonts'), path.resolve(process.cwd(), 'src/assets/fonts')];

  return candidates
    .map((directory) => path.join(directory, fileName))
    .find((file) => fs.existsSync(file));
};

/**
 * Register the four document faces on a PDFKit document.
 *
 * Every alias is always registered: if a TTF is missing, PDFKit receives the
 * corresponding standard font name instead. That keeps rendering deterministic
 * without requiring callers to branch on the filesystem.
 */
export const registerPdfFonts = (
  doc: PDFKit.PDFDocument,
  options: RegisterPdfFontsOptions = {},
): void => {
  for (const role of Object.keys(FONT_FILES) as (keyof typeof FONTS)[]) {
    const file = fontPath(FONT_FILES[role], options.fontDir);
    doc.registerFont(FONTS[role], file ?? FALLBACK_FONTS[role]);
  }
};
