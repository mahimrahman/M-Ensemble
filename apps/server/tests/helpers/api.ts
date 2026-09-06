import supertest from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { MOCK_PASSWORD } from '../../src/shared.js';

export const app: Express = createApp();
export const api = supertest(app);

/** Signs in a seeded user and returns their bearer token. */
export async function tokenFor(email: string): Promise<string> {
  const res = await api
    .post('/api/auth/login')
    .send({ email, password: MOCK_PASSWORD })
    .expect(200);
  return res.body.data.token as string;
}

/** The seeded people the tests speak as. */
export const YUSUF = 'yusuf@example.com'; // user_001, member @ Khadija
export const AMINA = 'amina@example.com'; // user_002, admin @ Khadija
