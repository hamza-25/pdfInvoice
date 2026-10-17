import { describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Response as SuperAgentResponse } from 'superagent';
import app from '../src/app';
import { extractPdfText, isPdf } from './helpers/pdf';

/** Collect the raw response body as a Buffer (the response is a PDF). */
const binaryParser = (res: NodeJS.ReadableStream, callback: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

const postInvoice = (payload: unknown) =>
  request(app)
    .post('/pdf/invoice-generate')
    .send(payload as object)
    .buffer(true)
    .parse(binaryParser as unknown as (res: SuperAgentResponse, cb: (err: Error | null, body: unknown) => void) => void);

/** Same endpoint, but let supertest parse the JSON body (for 400 responses). */
const postInvoiceJson = (payload: unknown) =>
  request(app).post('/pdf/invoice-generate').send(payload as object);

/** Minimal payload that satisfies every required validation rule. */
const validPayload = {
  documentType: 'SERVICE INVOICE',
  company: { name: 'Acme' },
  client: { name: 'Bob' },
  issueDate: '2026-01-01',
  items: [{ description: 'Widget', quantity: 2, price: 10 }],
  taxRate: 10,
  currency: '$',
};

describe('GET /', () => {
  it('renders the invoice form', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Professional Document Builder');
    expect(res.text).toContain('id="invoice-form"');
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
  });

  it('computes subtotal, tax and total correctly (2 x 10 @ 10% = 22)', async () => {
    const res = await postInvoice(validPayload);
    const text = extractPdfText(res.body);

    expect(text).toContain('Tax (10%)');
    expect(text).toContain('2.00$'); // tax amount
    expect(text).toContain('22$'); // grand total
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
    expect(text).toContain('[Acme'); // footer contact line renders, just empty entries
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
    Array.from({ length: n }, (_, i) => ({ description: `Item ${i + 1}`, quantity: 1, price: i + 1 }));

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
