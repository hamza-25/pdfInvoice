import { describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Response as SuperAgentResponse } from 'superagent';
import app from '../src/app';
import { extractPdfText, isPdf, countPdfPages } from './helpers/pdf';
/** Collect the raw response body as a Buffer (the response is a PDF). */
const binaryParser = (
  res: NodeJS.ReadableStream,
  callback: (err: Error | null, body: Buffer) => void,
) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

const postInvoice = (payload: unknown) =>
  request(app)
    .post('/pdf/invoice-generate')
    .send(payload as object)
    .buffer(true)
    .parse(
      binaryParser as unknown as (
        res: SuperAgentResponse,
        cb: (err: Error | null, body: unknown) => void,
      ) => void,
    );

/** Same endpoint, but let supertest parse the JSON body (for 400 responses). */
const postInvoiceJson = (payload: unknown) =>
  request(app)
    .post('/pdf/invoice-generate')
    .send(payload as object);

/** Minimal payload that satisfies every required validation rule. */
const validPayload = {
  documentType: 'SERVICE INVOICE',
  company: { name: 'Acme' },
  client: { name: 'Bob' },
  issueDate: '2026-01-01',
  items: [{ description: 'Widget', quantity: 2, price: 10 }],
  taxRate: 10,
  currency: 'USD',
};

describe('GET /', () => {
  it('renders the invoice form with the language switcher', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Professional Document Builder');
    expect(res.text).toContain('id="invoice-form"');
    expect(res.text).toContain('src="/i18n.js"'); // dictionaries loaded as a script
    expect(res.text).toContain('data-lang="fr"'); // EN|FR switcher present
  });
});

describe('GET /i18n.js (chunk 5.3)', () => {
  it('serves both dictionaries as a script the browser can load', async () => {
    const res = await request(app).get('/i18n.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
    expect(res.text).toContain('window.I18N');
    expect(res.text).toContain('"ui.submit"');
    expect(res.text).toContain('Générer le PDF'); // FR UI
    expect(res.text).toContain('Generate PDF'); // EN UI
  });
});

describe('POST /pdf/invoice-generate — happy path', () => {
  it('returns a valid PDF for a fully populated payload', async () => {
    const res = await postInvoice({
      ...validPayload,
      company: { name: 'Acme', address: '1 Main St', city: 'NY', phone: '123', email: 'a@b.com' },
      client: { name: 'Bob', address: '2 Oak St', city: 'LA', phone: '456', email: 'c@d.com' },
      dueDate: '2026-01-31',
      paymentType: 'Bank Transfer',
      notes: 'Thank you!',
    });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(isPdf(res.body)).toBe(true);

    const text = extractPdfText(res.body);
    expect(text).toContain('Acme');
    expect(text).toContain('Bob');
    expect(text).toContain('Widget');
    expect(text).toContain('PAYMENT METHOD');
    expect(text).toContain('Bank Transfer');
    expect(text).toContain('NOTES');
    expect(text).toContain('Thank you!');
    expect(text).toContain('Acme · 123 · a@b.com');
    expect(text).not.toContain('[Acme');
  });

  it('computes subtotal, tax and total correctly (2 x 10 @ 10% = 22)', async () => {
    const res = await postInvoice(validPayload);
    const text = extractPdfText(res.body);

    expect(text).toContain('Tax (10%)');
    expect(text).toContain('2.00 $'); // tax amount
    expect(text).toContain('22.00 $'); // grand total
  });

  it('exposes the generated document number in X-Invoice-Number (chunk R6)', async () => {
    const res = await postInvoice(validPayload);

    const number = res.headers['x-invoice-number'];
    expect(number).toMatch(/^INV-\d{4}-\d{4}$/);
    // The same number is printed in the PDF header.
    expect(extractPdfText(res.body)).toContain(number);
  });

  it('handles numeric quantity/price directly (chunk 1.2 type contract)', async () => {
    const res = await postInvoice(validPayload);
    expect(res.status).toBe(200);
    const text = extractPdfText(res.body);
    expect(text).toContain('22.00 $');

    // numeric strings pass validation and still compute correctly at runtime
    const asStrings = await postInvoice({
      ...validPayload,
      items: [{ description: 'd', quantity: '2', price: '10' }],
    });
    expect(asStrings.status).toBe(200);
    expect(extractPdfText(asStrings.body)).toContain('22.00 $');
  });
});

describe('POST /pdf/invoice-generate — optional fields / undefined guards', () => {
  it('accepts a payload with only the required fields (optional fields omitted)', async () => {
    const res = await postInvoice(validPayload);
    expect(res.status).toBe(200);
    expect(isPdf(res.body)).toBe(true);
  });

  it('does not write literal "undefined" into the PDF when phone/email are omitted', async () => {
    const res = await postInvoice(validPayload);
    const text = extractPdfText(res.body);
    expect(text.toLowerCase()).not.toContain('undefined');
    expect(text).toContain('Thank you for your business!'); // footer renders
    expect(text).not.toContain('[Acme'); // no bracketed debug-style contact line
  });
});

describe('POST /pdf/invoice-generate — validation errors', () => {
  it('returns 400 JSON for an empty body', async () => {
    const res = await postInvoiceJson({});
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/json');
    expect(Array.isArray(res.body.errors)).toBe(true);
    const paths = res.body.errors.map((e: { path: string }) => e.path);
    expect(paths).toContain('documentType');
    expect(paths).toContain('company.name');
    expect(paths).toContain('client.name');
    expect(paths).toContain('issueDate');
  });

  it('does NOT require the now-optional fields (address/city/phone/email/paymentType)', async () => {
    const res = await postInvoice({
      documentType: 'X',
      company: { name: 'A' },
      client: { name: 'B' },
      issueDate: '2026-01-01',
      items: [{ description: 'd', quantity: 1, price: 1 }],
      taxRate: 0,
      currency: '$',
    });
    expect(res.status).toBe(200);
  });

  it('uses the correct message for a non-object client', async () => {
    const res = await postInvoiceJson({ ...validPayload, client: 'not-an-object' });
    const msgs = res.body.errors.map((e: { msg: string }) => e.msg);
    expect(msgs).toContain('Client must be an object');
  });

  it('rejects an invalid company email with the right message', async () => {
    const res = await postInvoiceJson({ ...validPayload, company: { name: 'A', email: 'nope' } });
    expect(res.status).toBe(400);
    const msgs = res.body.errors.map((e: { msg: string }) => e.msg);
    expect(msgs).toContain('Company email must be a valid email address');
  });

  it('accepts an empty-string optional email (does not force a valid address)', async () => {
    const res = await postInvoice({ ...validPayload, company: { name: 'A', email: '' } });
    expect(res.status).toBe(200);
  });

  it('uses the correct message for a non-numeric quantity', async () => {
    const res = await postInvoiceJson({
      ...validPayload,
      items: [{ description: 'd', quantity: 'abc', price: 1 }],
    });
    expect(res.status).toBe(400);
    const msgs = res.body.errors.map((e: { msg: string }) => e.msg);
    expect(msgs).toContain('Item quantity must be a number');
  });
});

describe('POST /pdf/invoice-generate — item limit (chunk 1.1)', () => {
  const makeItems = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      description: `Item ${i + 1}`,
      quantity: 1,
      price: i + 1,
    }));

  it('accepts exactly 15 items', async () => {
    const res = await postInvoice({ ...validPayload, items: makeItems(15) });
    expect(res.status).toBe(200);
    expect(isPdf(res.body)).toBe(true);
  });

  it('rejects 16 items with a clear message', async () => {
    const res = await postInvoiceJson({ ...validPayload, items: makeItems(16) });
    expect(res.status).toBe(400);
    const msgs = res.body.errors.map((e: { msg: string }) => e.msg);
    expect(msgs).toContain('Items must be an array with at most 15 entries');
  });
});

describe('POST /pdf/invoice-generate — dynamic layout (chunk 1.3)', () => {
  const makeItems = (n: number, description = (i: number) => `Line item ${i + 1}`) =>
    Array.from({ length: n }, (_, i) => ({
      description: description(i),
      quantity: 1,
      price: i + 1,
    }));

  it('paginates when wrapped rows overflow one page (15 items, multi-line)', async () => {
    const rows = makeItems(
      15,
      (i) =>
        `ITEM_${String(i + 1).padStart(2, '0')} ` +
        'lorem ipsum dolor sit amet consectetur adipiscing elit '.repeat(6),
    );
    const res = await postInvoice({ ...validPayload, items: rows });
    expect(res.status).toBe(200);
    expect(countPdfPages(res.body)).toBeGreaterThan(1);

    const text = extractPdfText(res.body);
    for (let i = 1; i <= 15; i += 1) {
      expect(text).toContain(`ITEM_${String(i).padStart(2, '0')}`);
    }
    // totals still rendered once, after the last row
    expect(text).toContain('Tax (10%)');
    expect(text).toContain('132'); // sum(1..15) = 120, + 10% tax = 132
  });

  it('stamps page numbers and a continuation header on every page (chunk 4.2)', async () => {
    const rows = makeItems(
      15,
      (i) =>
        `ITEM_${String(i + 1).padStart(2, '0')} ` +
        'lorem ipsum dolor sit amet consectetur adipiscing elit '.repeat(6),
    );
    const res = await postInvoice({ ...validPayload, items: rows });
    expect(res.status).toBe(200);

    const pages = countPdfPages(res.body);
    expect(pages).toBeGreaterThan(1);

    const text = extractPdfText(res.body);
    expect(text).toContain(`Page 1 of ${pages}`);
    expect(text).toContain(`Page ${pages} of ${pages}`);

    // the continuation header repeats the company name above the table on page 2+
    const companyMentions = (text.match(/Acme/g) ?? []).length;
    expect(companyMentions).toBeGreaterThanOrEqual(2);
  });

  it('renders a long description in full (wrapping, not truncating)', async () => {
    const longDescription =
      'A very long description that should wrap across several lines within the description column ' +
      'without overlapping the quantity or amount columns, and it must still be completely visible in the output.';
    const res = await postInvoice({ ...validPayload, items: makeItems(1, () => longDescription) });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    for (const word of ['wrap', 'several', 'overlapping', 'completely', 'visible']) {
      expect(text).toContain(word);
    }
  });
});

describe('POST /pdf/invoice-generate — items table (P3)', () => {
  it('prints numbered rows, unit prices and line amounts', async () => {
    const res = await postInvoice({
      ...validPayload,
      items: [
        { description: 'Widget', quantity: 2, price: 10 },
        { description: 'Gadget', quantity: 1, price: 5 },
      ],
    });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('QTY');
    expect(text).toContain('UNIT PRICE');
    expect(text).toContain('AMOUNT');
    expect(text).toContain('01Widget');
    expect(text).toContain('02Gadget');
    expect(text).toContain('10.00 $'); // unit price
    expect(text).toContain('20.00 $'); // line amount
    expect(text).toContain('5.00 $'); // second line amount
  });
});

describe('POST /pdf/invoice-generate — totals ledger (P4)', () => {
  const ledgerPayload = {
    ...validPayload,
    items: [
      { description: 'Widget', quantity: 2, price: 10 },
      { description: 'Gadget', quantity: 1, price: 5 },
    ],
  };

  it('prints subtotal, tax and total as one ledger', async () => {
    const res = await postInvoice(ledgerPayload);
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('SUBTOTAL');
    expect(text).toContain('25.00 $'); // 2 x 10 + 1 x 5
    expect(text).toContain('Tax (10%)');
    expect(text).toContain('2.50 $');
    expect(text).toContain('TOTAL');
    expect(text).toContain('27.50 $');
    // The new subtotal row precedes the accent grand total.
    expect(text.indexOf('SUBTOTAL')).toBeLessThan(text.lastIndexOf('TOTAL'));
  });

  it('localises the ledger labels in French', async () => {
    const res = await postInvoice({ ...ledgerPayload, language: 'fr' });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('SOUS-TOTAL');
    expect(text).toContain('Taxe (10%)');
    expect(text).toContain('TOTAL');
    expect(text).toContain('27.50 $');
  });
});

describe('POST /pdf/invoice-generate — payment, notes and footer (P5)', () => {
  it('prints payment and notes only when they are supplied', async () => {
    const withExtras = await postInvoice({
      ...validPayload,
      paymentType: 'Bank Transfer',
      notes: 'Please pay within 30 days.',
    });
    expect(withExtras.status).toBe(200);

    const text = extractPdfText(withExtras.body);
    expect(text).toContain('PAYMENT METHOD');
    expect(text).toContain('Bank Transfer');
    expect(text).toContain('NOTES');
    expect(text).toContain('Please pay within 30 days.');

    const withoutExtras = await postInvoice(validPayload);
    expect(withoutExtras.status).toBe(200);

    const plain = extractPdfText(withoutExtras.body);
    expect(plain).not.toContain('PAYMENT METHOD');
    expect(plain).not.toContain('NOTES');
  });

  it('joins the non-empty company contact fields in the footer', async () => {
    const res = await postInvoice({
      ...validPayload,
      company: { name: 'Acme', phone: '123', email: 'a@b.com' },
    });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('Thank you for your business!');
    expect(text).toContain('Acme · 123 · a@b.com');
    expect(text).not.toContain('[Acme');
    expect(text).not.toContain('undefined');
  });

  it('localises the payment and notes labels in French', async () => {
    const res = await postInvoice({
      ...validPayload,
      language: 'fr',
      paymentType: 'Virement bancaire',
      notes: 'Merci de votre confiance.',
    });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('MODE DE PAIEMENT');
    expect(text).toContain('Virement bancaire');
    expect(text).toContain('NOTES');
    expect(text).toContain('Merci de votre confiance.');
    expect(text).not.toContain('PAYMENT METHOD');
  });
});

describe('POST /pdf/invoice-generate — server-side totals (chunk 1.4)', () => {
  it('ignores client-supplied subtotal/total and uses the computed values', async () => {
    const res = await postInvoice({ ...validPayload, subtotal: 999, total: 1 });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('22.00 $'); // computed: 2 x 10 = 20, + 10% tax = 22
    expect(text).not.toContain('999'); // client subtotal discarded
  });
});

describe('POST /pdf/invoice-generate — invoice numbers (chunk 1.6)', () => {
  it('assigns distinct, readable INV-YYYY-NNNN numbers to consecutive requests', async () => {
    const first = await postInvoice(validPayload);
    const second = await postInvoice(validPayload);

    const numberA = extractPdfText(first.body).match(/INV-\d{4}-\d{4}/)?.[0];
    const numberB = extractPdfText(second.body).match(/INV-\d{4}-\d{4}/)?.[0];

    expect(numberA).toBeTruthy();
    expect(numberB).toBeTruthy();
    expect(numberA).not.toBe(numberB);
  });
});

describe('POST /pdf/invoice-generate — document types (chunk 4.1)', () => {
  it('renders a QUOTE with its own title and "VALID UNTIL" label (uses dueDate)', async () => {
    const res = await postInvoice({
      ...validPayload,
      documentType: 'QUOTE',
      dueDate: '2026-02-15',
    });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('QUOTE');
    expect(text).toContain('QUOTE #');
    expect(text).toContain('VALID UNTIL:');
    expect(text).toContain('February 15, 2026'); // dueDate, locale-formatted (chunk 4.6)
  });

  it('prints DATE, not VALID UNTIL, for a quote without a due date (P2)', async () => {
    const res = await postInvoice({ ...validPayload, documentType: 'QUOTE' });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('DATE:');
    expect(text).not.toContain('VALID UNTIL:');
  });

  it('prints DUE DATE for an invoice that has a due date (P2)', async () => {
    const res = await postInvoice({ ...validPayload, dueDate: '2026-01-31' });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('DUE DATE:');
    expect(text).toContain('January 31, 2026');
  });

  it('renders a RECEIPT with its own title and "PAID ON" label', async () => {
    const res = await postInvoice({ ...validPayload, documentType: 'RECEIPT' });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('RECEIPT');
    expect(text).toContain('RECEIPT #');
    expect(text).toContain('PAID ON:');
  });

  it('renders PRODUCT INVOICE as an invoice', async () => {
    const res = await postInvoice({ ...validPayload, documentType: 'PRODUCT INVOICE' });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('INVOICE #');
    expect(text).toContain('DATE:');
  });

  it('falls back to the invoice style for an unknown document type', async () => {
    const res = await postInvoice({ ...validPayload, documentType: 'SOMETHING ELSE' });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('INVOICE #');
  });
});

describe('POST /pdf/invoice-generate — money rounding', () => {
  it('rounds tax and total to 2 decimals (2999.97 @ 5% = 150.00 tax, 3149.97 total)', async () => {
    const res = await postInvoice({
      ...validPayload,
      items: [{ description: 'Big widget', quantity: 1, price: 2999.97 }],
      taxRate: 5,
    });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('150.00 $'); // raw: 149.9985
    expect(text).toContain('3,149.97 $'); // raw: 3149.9685 (en-US grouping)
    expect(text).not.toContain('3149.9685'); // float artifact must never leak into the PDF
  });

  it('rounds float-trap values (19.99 x 3 @ 7.25%)', async () => {
    const res = await postInvoice({
      ...validPayload,
      items: [{ description: 'Trap', quantity: 3, price: 19.99 }],
      taxRate: 7.25,
    });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    // subtotal 59.97, tax 4.347825 -> 4.35, total 64.317825 -> 64.32
    expect(text).toContain('4.35 $');
    expect(text).toContain('64.32 $');
    expect(text).not.toContain('64.31');
  });
});

describe('POST /pdf/invoice-generate — locale-aware money & dates (chunk 4.6)', () => {
  it('renders MAD amounts with French separators and the dh symbol', async () => {
    const res = await postInvoice({
      ...validPayload,
      currency: 'MAD',
      items: [{ description: 'W', quantity: 1, price: 1234.5 }],
    });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('1.234,50 dh'); // line amount (fr-MA groups with '.')
    expect(text).toContain('1.357,95 dh'); // total incl. 10% tax
  });

  it('renders JPY without fractional digits', async () => {
    const res = await postInvoice({
      ...validPayload,
      currency: 'JPY',
      items: [{ description: 'W', quantity: 1, price: 1234 }],
    });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('1,234 ¥'); // line amount
    expect(text).toContain('1,357 ¥'); // 1234 * 1.1 = 1357.4 -> whole yen
    expect(text).toContain('January 1, 2026'); // dates follow language (en default)
  });

  it('formats the header date per document language (chunk 5.2)', async () => {
    const en = await postInvoice(validPayload);
    expect(en.status).toBe(200);
    expect(extractPdfText(en.body)).toContain('January 1, 2026');

    const fr = await postInvoice({ ...validPayload, currency: 'EUR', language: 'fr' });
    expect(fr.status).toBe(200);
    expect(extractPdfText(fr.body)).toContain('1 janvier 2026'); // fr-FR long date
  });

  it('still accepts legacy symbol payloads (backward compatibility)', async () => {
    const res = await postInvoice({ ...validPayload, currency: '$' });
    expect(res.status).toBe(200);
    expect(extractPdfText(res.body)).toContain('22.00 $');
  });
});

describe('language field (chunk 5.1)', () => {
  it('accepts en, fr, or omission (defaults to en)', async () => {
    expect((await postInvoice({ ...validPayload, language: 'fr' })).status).toBe(200);
    expect((await postInvoice({ ...validPayload, language: 'en' })).status).toBe(200);
    expect((await postInvoice(validPayload)).status).toBe(200);
  });

  it('rejects unsupported languages with a 400', async () => {
    const res = await postInvoiceJson({ ...validPayload, language: 'de' });
    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    const messages = res.body.errors.map((e: { msg: string }) => e.msg);
    expect(messages).toContain('Language must be "en" or "fr"');
  });
});

describe('POST /pdf/invoice-generate — French validation errors (chunk 5.4)', () => {
  it('translates validation messages when language=fr', async () => {
    const res = await postInvoiceJson({ company: {}, client: {}, items: [{}], language: 'fr' });
    expect(res.status).toBe(400);

    const messages = res.body.errors.map((e: { msg: string }) => e.msg);
    expect(messages).toContain('Le type de document est requis');
    expect(messages).toContain('Le nom de la société est requis');
    expect(messages).toContain('Le nom du client est requis');
    expect(messages).toContain("La date d'émission est requise");
    expect(messages).toContain('La devise est requise');
    expect(messages).toContain("La description de l'article est requise");
    // no English leakage
    expect(messages.join(' ')).not.toContain('is required');
    expect(messages.join(' ')).not.toContain('must be');
  });

  it('keeps English messages when no language is sent', async () => {
    const res = await postInvoiceJson({ company: {}, client: {}, items: [{}] });
    expect(res.status).toBe(400);

    const messages = res.body.errors.map((e: { msg: string }) => e.msg);
    expect(messages).toContain('Document type is required');
    expect(messages).toContain('Company name is required');
  });
});

describe('POST /pdf/invoice-generate — French PDF (chunk 5.2)', () => {
  it('renders the whole invoice in French when language=fr', async () => {
    const res = await postInvoice({ ...validPayload, language: 'fr' });
    expect(res.status).toBe(200);

    const text = extractPdfText(res.body);
    expect(text).toContain('FACTURE'); // title
    expect(text).toContain('FACTURE #'); // document number label
    expect(text).toContain('FACTURER À');
    expect(text).toContain('QTÉ');
    expect(text).toContain('PRIX UNITAIRE');
    expect(text).toContain('MONTANT');
    expect(text).toContain('Taxe (10%)');
    expect(text).toContain('Merci pour votre affaire !');
    expect(text).toContain('Si vous avez des questions'); // contact note
    expect(text).toContain('Page 1 sur 1');
    expect(text).toContain('1 janvier 2026'); // fr-FR long date

    // English counterparts must not leak through
    expect(text).not.toContain('BILL TO');
    expect(text).not.toContain('QTY');
    expect(text).not.toContain('UNIT PRICE');
    expect(text).not.toContain('Thank you for your business');
  });

  it('renders a French RECEIPT and QUOTE with translated labels', async () => {
    const receipt = await postInvoice({
      ...validPayload,
      documentType: 'RECEIPT',
      language: 'fr',
    });
    expect(receipt.status).toBe(200);
    const receiptText = extractPdfText(receipt.body);
    expect(receiptText).toContain('REÇU');
    expect(receiptText).toContain('REÇU LE'); // "PAID ON" in French

    const quote = await postInvoice({
      ...validPayload,
      documentType: 'QUOTE',
      dueDate: '2026-02-15',
      language: 'fr',
    });
    expect(quote.status).toBe(200);
    const quoteText = extractPdfText(quote.body);
    expect(quoteText).toContain('DEVIS');
    expect(quoteText).toContain("VALIDE JUSQU'AU");
    expect(quoteText).toContain('15 février 2026'); // dueDate in French
  });
});
