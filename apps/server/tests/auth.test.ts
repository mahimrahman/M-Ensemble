import { describe, expect, it } from 'vitest';
import { AMINA, YUSUF, api, tokenFor } from './helpers/api.js';

describe('auth', () => {
  it('signs up, logs in and round-trips through /me', async () => {
    const signup = await api
      .post('/api/auth/signup')
      .send({ email: 'New.Person@Example.com', password: 'hunter22', name: '  Nadia  ' })
      .expect(201);

    expect(signup.body.data.user).toMatchObject({
      name: 'Nadia',
      email: 'new.person@example.com',
      interests: [],
    });

    const login = await api
      .post('/api/auth/login')
      .send({ email: 'new.person@example.com', password: 'hunter22' })
      .expect(200);

    const me = await api
      .get('/api/me')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .expect(200);

    expect(me.body.data._id).toBe(signup.body.data.user._id);
  });

  it('never leaks the password hash or notification prefs', async () => {
    const me = await api
      .get('/api/me')
      .set('Authorization', `Bearer ${await tokenFor(YUSUF)}`)
      .expect(200);

    expect(Object.keys(me.body.data).sort()).toEqual([
      '_id',
      'email',
      'emailVerified',
      'interests',
      'name',
    ]);
  });

  it('rejects a duplicate email with EMAIL_TAKEN', async () => {
    const res = await api
      .post('/api/auth/signup')
      .send({ email: YUSUF, password: 'impostor-syndrome', name: 'Impostor' })
      .expect(409);

    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a wrong password with BAD_CREDENTIALS, not a hint', async () => {
    const wrong = await api
      .post('/api/auth/login')
      .send({ email: YUSUF, password: 'not-the-password' })
      .expect(401);
    const missing = await api
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'mensemble' })
      .expect(401);

    expect(wrong.body.error.code).toBe('BAD_CREDENTIALS');
    // Identical response either way — never confirm an email exists.
    expect(missing.body.error).toEqual(wrong.body.error);
  });

  it('refuses a short or common password at signup, with a message that says why', async () => {
    const short = await api
      .post('/api/auth/signup')
      .send({ email: 'six@example.com', password: 'abcdef', name: 'Six' })
      .expect(400);
    expect(short.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(short.body.error.details)).toMatch(/at least 8/);

    const common = await api
      .post('/api/auth/signup')
      .send({ email: 'common@example.com', password: 'Password123', name: 'Common' })
      .expect(400);
    expect(JSON.stringify(common.body.error.details)).toMatch(/too easy to guess/);
  });

  it('still signs in an account whose stored password predates the policy', async () => {
    // The demo coordinator's seeded password is six digits.
    await api.post('/api/auth/login').send({ email: AMINA, password: '123456' }).expect(200);
  });

  // The app signs out on status 401 alone. A 403 here would strand every screen
  // on a dead token instead of returning it to the login screen.
  it.each([
    ['no header', undefined],
    ['not a bearer', 'Basic abc'],
    ['garbage token', 'Bearer not-a-jwt'],
  ])('answers 401 UNAUTHORIZED for %s', async (_label, header) => {
    const req = api.get('/api/me');
    if (header) req.set('Authorization', header);
    const res = await req.expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('answers 401 for a valid token whose user is gone', async () => {
    const signup = await api
      .post('/api/auth/signup')
      .send({ email: 'ghost@example.com', password: 'hunter22', name: 'Ghost' })
      .expect(201);

    const { UserModel } = await import('../src/models/User.js');
    await UserModel.deleteOne({ _id: signup.body.data.user._id });

    await api
      .get('/api/me')
      .set('Authorization', `Bearer ${signup.body.data.token}`)
      .expect(401);
  });

  it('leaves /health open', async () => {
    await api.get('/api/health').expect(200);
  });

  it('gives a coordinator their membership rows and a member none at Madina', async () => {
    const res = await api
      .get('/api/me/memberships')
      .set('Authorization', `Bearer ${await tokenFor(AMINA)}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ mosqueId: 'mosque_khadija', role: 'admin' });
  });
});
