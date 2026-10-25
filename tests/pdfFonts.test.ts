import { describe, expect, it } from 'vitest';
import PDFDocument from 'pdfkit';
import { FONTS, PAGE } from '../src/services/pdfLayout';
import { registerPdfFonts } from '../src/services/pdfFonts';
import { extractPdfText } from './helpers/pdf';

/** Render a tiny document through a supplied font-registration callback. */
const render = (register: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      register(doc);
      doc
        .font(FONTS.sans)
        .fontSize(12)
        .text('ÉMETTEUR · REÇU · 1 janvier 2026')
        .font(FONTS.sansMedium)
        .text('Medium')
        .font(FONTS.sansBold)
        .text('SemiBold')
        .font(FONTS.display)
        .text('Display');
      doc.end();
    } catch (error) {
      reject(error);
    }
  });

describe('embedded PDF fonts (P9)', () => {
  it('embeds the bundled IBM Plex Sans and Spectral faces', async () => {
    const pdf = await render((doc) => registerPdfFonts(doc));
    const raw = pdf.toString('latin1');

    expect((raw.match(/\/FontFile2\b/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(raw).toContain('IBMPlexSans');
    expect(raw).toContain('Spectral-SemiBold');
    expect(await extractPdfText(pdf)).toContain('ÉMETTEUR · REÇU · 1 janvier 2026');
  });

  it('falls back to Helvetica/Times when the font files are missing', async () => {
    const pdf = await render((doc) =>
      registerPdfFonts(doc, { fontDir: '/definitely/not/a/font/directory' }),
    );
    const raw = pdf.toString('latin1');

    expect(raw).toContain('/BaseFont /Helvetica');
    expect(raw).toContain('/BaseFont /Helvetica-Bold');
    expect(raw).toContain('/BaseFont /Times-Bold');
    expect(raw).not.toContain('/FontFile2');
    expect(await extractPdfText(pdf)).toContain('ÉMETTEUR · REÇU · 1 janvier 2026');
  });
});
