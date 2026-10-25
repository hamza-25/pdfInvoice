import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { extractPdfText } from './helpers/pdf';

const validPayload = {
  documentType: 'SERVICE INVOICE',
  company: { name: 'Acme' },
  client: { name: 'Bob' },
  issueDate: '2026-01-01',
  items: [{ description: 'Widget', quantity: 2, price: 10 }],
  taxRate: 10,
  currency: '$',
};

/** A description containing NUL, BEL and DEL control characters. */
const dirtyDescription = `A${String.fromCharCode(0, 7, 127)}B${String.fromCharCode(11)}C`;

describe('PDF-safe sanitization (chunk 3.2)', () => {
  it('renders apostrophes and ampersands correctly (no HTML escaping)', async () => {
    const res = await request(app)
      .post('/pdf/invoice-generate')
      .send({ ...validPayload, company: { name: "O'Brien & Sons" } })
      .buffer(true);

    expect(res.status).toBe(200);
    const text = await extractPdfText(res.body);
    expect(text).toContain("O'Brien & Sons");
    expect(text).not.toContain('&#39;'); // old .escape() corruption
    expect(text).not.toContain('&amp;');
  });

  it('strips control characters from text fields', async () => {
    const res = await request(app)
      .post('/pdf/invoice-generate')
      .send({
        ...validPayload,
        items: [{ description: dirtyDescription, quantity: 1, price: 5 }],
      })
      .buffer(true);

    expect(res.status).toBe(200);
    expect(await extractPdfText(res.body)).toContain('ABC');
  });

  it('preserves newlines in descriptions', async () => {
    const res = await request(app)
      .post('/pdf/invoice-generate')
      .send({
        ...validPayload,
        items: [{ description: 'Line one\nLine two', quantity: 1, price: 5 }],
      })
      .buffer(true);

    expect(res.status).toBe(200);
    const text = await extractPdfText(res.body);
    expect(text).toContain('Line one');
    expect(text).toContain('Line two');
  });

  it('rejects an over-long item description with a clear message', async () => {
    const res = await request(app)
      .post('/pdf/invoice-generate')
      .send({
        ...validPayload,
        items: [{ description: 'x'.repeat(1001), quantity: 1, price: 5 }],
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.errors)).toContain(
      'Item description must be at most 1000 characters',
    );
  });

  it('rejects over-long notes with a clear message', async () => {
    const res = await request(app)
      .post('/pdf/invoice-generate')
      .send({ ...validPayload, notes: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.errors)).toContain('Notes must be at most 2000 characters');
  });

  it('rejects an over-long company name with a clear message', async () => {
    const res = await request(app)
      .post('/pdf/invoice-generate')
      .send({ ...validPayload, company: { name: 'x'.repeat(201) } });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.errors)).toContain(
      'Company name must be at most 200 characters',
    );
  });
});
