import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { RequestHandler } from 'express';
import request from 'supertest';
import { catchAsync } from '../src/utils/catchAsync';
import { errorHandler } from '../src/middleware/errorHandler';

/** A minimal app that mounts one route plus the real terminal error handler. */
const buildApp = (handler: RequestHandler) => {
  const app = express();
  app.get('/boom', handler);
  app.use(errorHandler);
  return app;
};

describe('async error wrapper (chunk 1.5)', () => {
  beforeEach(() => {
    // The handler logs the error; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards a rejected async handler to the JSON error handler', async () => {
    const app = buildApp(
      catchAsync(async () => {
        throw new Error('kaboom');
      }),
    );

    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('still returns a JSON 500 for a synchronous throw', async () => {
    const app = buildApp(() => {
      throw new Error('sync');
    });

    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('passes successful responses through untouched', async () => {
    const app = buildApp(
      catchAsync(async (_req, res) => {
        res.json({ ok: true });
      }),
    );

    const res = await request(app).get('/boom');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
