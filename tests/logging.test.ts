import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const validPayload = {
  documentType: 'SERVICE INVOICE',
  company: { name: 'Acme' },
  client: { name: 'Bob' },
  issueDate: '2026-01-01',
  items: [{ description: 'Widget', quantity: 2, price: 10 }],
  taxRate: 10,
  currency: '$',
};

describe('structured logging (chunk 3.3)', () => {
  it('emits JSON logs with a request id, validation warnings and generation timing', async () => {
    const logFile = path.join(os.tmpdir(), `pdfinvoice-logging-${process.pid}.log`);

    vi.resetModules();
    vi.stubEnv('LOG_LEVEL', 'info');
    vi.stubEnv('LOG_FILE', logFile);
    const { default: app } = await import('../src/app');

    await request(app).get('/');
    await request(app).post('/pdf/invoice-generate').send({}); // 400 -> warn
    await request(app)
      .post('/pdf/invoice-generate')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(validPayload)); // 200 -> info

    vi.unstubAllEnvs();

    const lines = fs
      .readFileSync(logFile, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    fs.unlinkSync(logFile);

    // access log: one JSON line per request, with a request id
    const access = lines.find(
      (l) => (l.req as { id?: string; url?: string })?.url === '/' && l.msg === 'request completed',
    );
    expect(access).toBeTruthy();
    expect(typeof (access!.req as { id?: string }).id).toBe('string');
    expect((access!.res as { statusCode?: number }).statusCode).toBe(200);

    // validation failures are logged at warn with the error details
    const validationFailed = lines.find((l) => l.msg === 'invoice validation failed');
    expect(validationFailed).toBeTruthy();
    expect(validationFailed!.level).toBe(40); // pino warn
    expect(Array.isArray(validationFailed!.errors)).toBe(true);

    // successful generation logs duration and the invoice number
    const generated = lines.find((l) => l.msg === 'invoice generated');
    expect(generated).toBeTruthy();
    expect(generated!.level).toBe(30); // pino info
    expect(typeof generated!.invoiceNumber).toBe('string');
    expect(typeof generated!.durationMs).toBe('number');
  });
});
