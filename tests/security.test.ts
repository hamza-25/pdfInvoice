import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';

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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('security headers (chunk 3.1)', () => {
  it('sends helmet security headers on the form page', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeTruthy();
    expect(res.headers['content-security-policy']).toContain('cdn.tailwindcss.com');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('does not advertise x-powered-by', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('payload limits (chunk 3.1)', () => {
  it('rejects a body over 200kb with 413', async () => {
    const res = await request(app)
      .post('/pdf/invoice-generate')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ ...validPayload, notes: 'x'.repeat(300_000) }));

    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Payload too large');
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/pdf/invoice-generate')
      .set('Content-Type', 'application/json')
      .send('{"broken');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Malformed JSON body');
  });
});

describe('same-origin stance (chunk 3.1)', () => {
  it('rejects cross-origin requests with 403', async () => {
    const res = await request(app)
      .post('/pdf/invoice-generate')
      .set('Origin', 'https://evil.example.com')
      .send(validPayload);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Cross-origin requests are not allowed');
  });

  it('rejects unparsable Origin headers with 403', async () => {
    const res = await request(app)
      .post('/pdf/invoice-generate')
      .set('Origin', 'not a url')
      .send(validPayload);

    expect(res.status).toBe(403);
  });

  it('allows same-origin requests', async () => {
    const res = await request(app)
      .post('/pdf/invoice-generate')
      .set('Host', 'example.com')
      .set('Origin', 'https://example.com')
      .buffer(true)
      .send(validPayload);

    expect(res.status).toBe(200);
  });
});

describe('rate limiting (chunk 3.1)', () => {
  it('returns 429 after more than 10 requests/minute to /pdf', async () => {
    vi.stubEnv('NODE_ENV', 'production'); // the limiter skips under test

    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post('/pdf/invoice-generate').send({});
      lastStatus = res.status;
      if (res.status === 429) {
        expect(res.headers['ratelimit']).toContain('limit=10');
        expect(res.body.error).toContain('Too many requests');
      }
    }

    expect(lastStatus).toBe(429);
  });

  it('does not rate limit the form page', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    for (let i = 0; i < 12; i++) {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
    }
  });
});
