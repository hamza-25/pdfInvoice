import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('health endpoint (chunk 3.4)', () => {
  it('returns 200 with status ok and uptime', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThan(0);
  });

  it('works under production mode (outside the /pdf rate limit)', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    for (let i = 0; i < 12; i++) {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    }

    vi.unstubAllEnvs();
  });
});
