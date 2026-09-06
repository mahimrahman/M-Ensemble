import { describe, expect, it } from 'vitest';
import { seedAll } from '../src/scripts/seedData.js';
import { SignupModel } from '../src/models/Signup.js';
import { UserModel } from '../src/models/User.js';
import { api, tokenFor, YUSUF } from './helpers/api.js';

/**
 * Seeding must never delete real data.
 *
 * This is a regression test for a bug that cost somebody their account: `seed`
 * used to `deleteMany` all eight collections before inserting the fixtures, so
 * anyone who signed up and then had the seed run against them found their login
 * answering "email or password incorrect" with no trace of why.
 *
 * The suite's own `beforeEach` still wipes — a test wants a clean slate — but
 * `seedAll` itself is now upsert-only, and that is what these assert.
 */
describe('seeding preserves real data', () => {
  /** Signs someone up the way the app does. */
  async function signUp(email: string, password = 'hunter22'): Promise<void> {
    await api.post('/api/auth/signup').send({ email, password, name: 'Real Person' }).expect(201);
  }

  it('keeps an account created outside the fixtures, and its password', async () => {
    const email = 'real.person@example.com';
    await signUp(email);

    await seedAll({ bcryptRounds: 4 });

    // Still there...
    expect(await UserModel.countDocuments({ email })).toBe(1);
    // ...and can still sign in, which is the part that actually broke.
    await api.post('/api/auth/login').send({ email, password: 'hunter22' }).expect(200);
  });

  it('keeps a signup someone made against a seeded post', async () => {
    const token = `Bearer ${await tokenFor(YUSUF)}`;
    const post = await api
      .get('/api/mosques/mosque_khadija/posts')
      .set('Authorization', token)
      .expect(200);
    const target = (post.body.data as { _id: string }[])[0]!;

    await api.post(`/api/posts/${target._id}/signup`).set('Authorization', token).expect(201);
    const before = await SignupModel.countDocuments({ postId: target._id, userId: 'user_001' });

    await seedAll({ bcryptRounds: 4 });

    expect(await SignupModel.countDocuments({ postId: target._id, userId: 'user_001' })).toBe(
      before,
    );
  });

  it('is idempotent — seeding twice does not duplicate anything', async () => {
    const before = await UserModel.countDocuments();
    await seedAll({ bcryptRounds: 4 });
    await seedAll({ bcryptRounds: 4 });
    expect(await UserModel.countDocuments()).toBe(before);
  });

  it('refreshes a fixture row that drifted', async () => {
    // Upserting has to still *update*, or re-seeding would stop fixing bad data.
    await UserModel.updateOne({ _id: 'user_001' }, { $set: { name: 'Wrong Name' } });
    await seedAll({ bcryptRounds: 4 });
    const user = await UserModel.findById('user_001');
    expect(user?.name).toBe('Yusuf Benali');
  });
});

describe('the demo coordinator', () => {
  it('signs in with its own password and holds the Khadijah role', async () => {
    const res = await api
      .post('/api/auth/login')
      .send({ email: 'khadija.mosque@gmail.com', password: '123456' })
      .expect(200);

    const memberships = await api
      .get('/api/me/memberships')
      .set('Authorization', `Bearer ${res.body.data.token}`)
      .expect(200);

    expect(memberships.body.data).toContainEqual(
      expect.objectContaining({ mosqueId: 'mosque_khadija', role: 'admin' }),
    );
  });

  it('does not share the volunteers’ password', async () => {
    // Proves `passwordFor` is actually per-account rather than one hash for all.
    await api
      .post('/api/auth/login')
      .send({ email: 'khadija.mosque@gmail.com', password: 'mensemble' })
      .expect(401);
  });
});
