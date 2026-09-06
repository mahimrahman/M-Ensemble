import supertest from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { DEMO_COORDINATOR_EMAIL, passwordFor } from '../../src/shared.js';

export const app: Express = createApp();
export const api = supertest(app);

/**
 * Signs in a seeded user and returns their bearer token.
 *
 * The password is looked up per account rather than shared: the volunteers all
 * use `MOCK_PASSWORD`, but the demo coordinator has its own.
 */
export async function tokenFor(email: string): Promise<string> {
  const res = await api
    .post('/api/auth/login')
    .send({ email, password: passwordFor(email) })
    .expect(200);
  return res.body.data.token as string;
}

/** The seeded people the tests speak as. */
export const YUSUF = 'yusuf@example.com'; // user_001, member @ Khadija
export const AMINA = DEMO_COORDINATOR_EMAIL; // user_002, admin @ Khadija
