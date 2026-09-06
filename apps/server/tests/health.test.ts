import { describe, expect, it } from 'vitest';
import { YUSUF, api, tokenFor } from './helpers/api.js';

describe('health', () => {
  it('reports up and connected', async () => {
    const res = await api.get('/api/health').expect(200);
    expect(res.body.data.status).toBe('up');
    expect(res.body.data.db).toBe('connected');
  });

  it('404s an unknown route with an uppercase code', async () => {
    // Signed in: the router-level auth gate runs before the 404 handler, so an
    // anonymous request to an unknown path is 401 — which is what we want,
    // since it tells a stranger nothing about which paths exist.
    const res = await api
      .get('/api/nope')
      .set('Authorization', `Bearer ${await tokenFor(YUSUF)}`)
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
