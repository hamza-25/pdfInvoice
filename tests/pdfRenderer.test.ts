import { describe, expect, it } from 'vitest';
import PDFDocument from 'pdfkit';
import type { invoiceData, invoiceItem } from '../src/interfaces';
import { buildInvoiceModel } from '../src/services/invoiceModel';
import { PAGE } from '../src/services/pdfLayout';
import { renderInvoicePdf } from '../src/services/pdfRenderer';
import { countPdfPages, extractPdfText, isPdf } from './helpers/pdf';

/**
 * Render through the same model + renderer pair the controller uses, without
 * exercising validation, numbering, rate limiting or the HTTP layer.
 */
const render = (payload: invoiceData): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      renderInvoicePdf(doc, buildInvoiceModel(payload));
      doc.end();
    } catch (error) {
      reject(error);
    }
  });

const base = (overrides: Partial<invoiceData> = {}): invoiceData => ({
  documentType: 'SERVICE INVOICE',
  company: {
    name: 'Northwind Studio',
    address: '14 Rue des Lilas',
    city: '75011 Paris',
    phone: '+33 1 45 67 89 00',
    email: 'hello@northwind.studio',
  },
  client: {
    name: 'Atelier Moreau',
    address: '8 Quai Saint-Vincent',
    city: '69001 Lyon',
    phone: '+33 4 78 12 34 56',
    email: 'compta@ateliermoreau.fr',
  },
  number: 'INV-2026-0001',
  issueDate: '2026-10-24',
  dueDate: '2026-11-23',
  items: [
    { description: 'Brand identity system', quantity: 1, price: 2400 },
    { description: 'Editorial layout and typesetting', quantity: 2, price: 850 },
  ],
  taxRate: 10,
  currency: 'USD',
  language: 'en',
  paymentType: 'Bank transfer — 30 days',
  notes: 'Thank you for your business.',
  ...overrides,
});

const longItems = (count = 15): invoiceItem[] =>
  Array.from({ length: count }, (_, index) => ({
    description:
      `ITEM_${String(index + 1).padStart(2, '0')} ` +
      'lorem ipsum dolor sit amet consectetur adipiscing elit '.repeat(6),
    quantity: 1,
    price: index + 1,
  }));

describe('PDF renderer smoke test (P7)', () => {
  it.each([
    {
      documentType: 'SERVICE INVOICE',
      title: 'INVOICE',
      idLabel: 'INVOICE #',
      primaryDate: 'DATE:',
      secondaryDate: 'DUE DATE:',
    },
    {
      documentType: 'PRODUCT INVOICE',
      title: 'INVOICE',
      idLabel: 'INVOICE #',
      primaryDate: 'DATE:',
      secondaryDate: 'DUE DATE:',
    },
    {
      documentType: 'QUOTE',
      title: 'QUOTE',
      idLabel: 'QUOTE #',
      primaryDate: 'VALID UNTIL:',
      secondaryDate: 'DATE:',
    },
    {
      documentType: 'RECEIPT',
      title: 'RECEIPT',
      idLabel: 'RECEIPT #',
      primaryDate: 'PAID ON:',
      secondaryDate: null,
    },
  ])('renders $documentType as a one-page PDF', async (testCase) => {
    const pdf = await render(base({ documentType: testCase.documentType }));
    expect(isPdf(pdf)).toBe(true);
    expect(countPdfPages(pdf)).toBe(1);

    const text = await extractPdfText(pdf);
    expect(text).toContain(testCase.title);
    expect(text).toContain(testCase.idLabel);
    expect(text).toContain(testCase.primaryDate);
    expect(text).toContain('Page 1 of 1');
    expect(text).toContain('SUBTOTAL');
    expect(text).toContain('TOTAL');
    expect(text).toContain('PAYMENT METHOD');
    expect(text).toContain('NOTES');

    if (testCase.secondaryDate) {
      expect(text).toContain(testCase.secondaryDate);
    } else {
      expect(text).not.toContain('DUE DATE:');
      expect(text).not.toContain('DATE:');
    }

    if (testCase.documentType === 'QUOTE') {
      expect(text).not.toContain('DUE DATE:');
    }
  });

  it('paginates 15 long rows into multiple pages', async () => {
    const pdf = await render(base({ items: longItems() }));
    expect(isPdf(pdf)).toBe(true);

    const pages = countPdfPages(pdf);
    expect(pages).toBeGreaterThan(1);

    const text = await extractPdfText(pdf);
    for (let index = 1; index <= 15; index += 1) {
      expect(text).toContain(`ITEM_${String(index).padStart(2, '0')}`);
    }
    expect(text).toContain(`Page 1 of ${pages}`);
    expect(text).toContain(`Page ${pages} of ${pages}`);
    expect((text.match(/Northwind Studio/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((text.match(/SUBTOTAL/g) ?? []).length).toBe(1);
  });

  it('renders the French labels through the same pipeline', async () => {
    const pdf = await render(
      base({
        language: 'fr',
        paymentType: 'Virement bancaire',
        notes: 'Merci de votre confiance.',
      }),
    );
    expect(isPdf(pdf)).toBe(true);
    expect(countPdfPages(pdf)).toBe(1);

    const text = await extractPdfText(pdf);
    expect(text).toContain('FACTURE');
    expect(text).toContain('FACTURE #');
    expect(text).toContain('ÉMETTEUR');
    expect(text).toContain('FACTURER À');
    expect(text).toContain("DATE D'ÉCHÉANCE");
    expect(text).toContain('SOUS-TOTAL');
    expect(text).toContain('Taxe (10%)');
    expect(text).toContain('MODE DE PAIEMENT');
    expect(text).toContain('Virement bancaire');
    expect(text).toContain('NOTES');
    expect(text).toContain('Merci de votre confiance.');
    expect(text).toContain('Merci pour votre affaire !');
    expect(text).toContain('Page 1 sur 1');
    expect(text).toContain('24 octobre 2026');

    expect(text).not.toContain('FROM');
    expect(text).not.toContain('INVOICE #');
    expect(text).not.toContain('BILL TO');
    expect(text).not.toContain('DUE DATE');
    expect(text).not.toContain('SUBTOTAL');
    expect(text).not.toContain('PAYMENT METHOD');
    expect(text).not.toContain('Thank you for your business');
    expect(text).not.toContain('Page 1 of');
  });

  it('embeds the bundled IBM Plex Sans and Spectral faces', async () => {
    const pdf = await render(base());
    const raw = pdf.toString('latin1');

    expect(raw).toContain('IBMPlexSans');
    expect(raw).toContain('Spectral-SemiBold');
    expect(raw).not.toContain('/BaseFont /Helvetica');
    expect(raw).not.toContain('/BaseFont /Times');
  });
});
