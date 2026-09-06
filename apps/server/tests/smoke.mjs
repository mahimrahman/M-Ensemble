/**
 * End-to-end smoke test against a REAL mongod and the REAL server process.
 *
 * Isolated on purpose: its own in-memory mongod, and the API on 4100 — never
 * 4000, which is the developer's own Atlas-backed dev server.
 *
 * The vitest suite builds the app with `createApp()` and never runs `index.ts`,
 * so it proves the routes and not the boot. This runs the actual entry point,
 * the actual seed, and the actual HTTP surface.
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

/** The server workspace — this file lives in its `tests/` directory. */
const WORKSPACE = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 4100, never 4000. Four thousand is the developer's own dev server, wired to
 * a real Atlas cluster; a smoke test that bound it would either fail on a port
 * clash or, worse, not.
 */
const PORT = 4100;
const BASE = `http://127.0.0.1:${PORT}`;

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri();
console.log(`[smoke] mongod at ${uri}`);

const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: String(PORT),
  MONGODB_URI: uri,
  JWT_SECRET: 'smoke-secret',
  LOG_LEVEL: 'tiny',
  UPLOAD_DIR: './tests/.smoke-uploads',
  SUPERADMIN_EMAIL: 'admin@mensemble.app',
  SUPERADMIN_PASSWORD: 'mensemble-admin',
};

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

function run(cmd, args, extraEnv = {}) {
  return spawn(cmd, args, {
    cwd: WORKSPACE,
    env: { ...env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
}

// ── Seed against the real database ──────────────────────────────────────────
console.log('[smoke] seeding…');
const seed = run('npx', ['tsx', 'src/scripts/seed.ts']);
let seedOut = '';
seed.stdout.on('data', (d) => (seedOut += d));
seed.stderr.on('data', (d) => (seedOut += d));
const seedCode = await new Promise((r) => seed.on('exit', r));
console.log(
  seedOut
    .trim()
    .split('\n')
    .map((l) => `      ${l}`)
    .join('\n'),
);
check('seed exits clean', seedCode === 0, `exit ${seedCode}`);

// ── Boot the real server ────────────────────────────────────────────────────
console.log('[smoke] starting the API…');
const server = run('npx', ['tsx', 'src/index.ts']);
server.stdout.on('data', (d) => process.stdout.write(`      [api] ${d}`));
server.stderr.on('data', (d) => process.stdout.write(`      [api!] ${d}`));

let up = false;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1500) });
    if (r.ok) {
      up = true;
      break;
    }
  } catch {
    /* not yet */
  }
  await sleep(500);
}
check('server answers /api/health', up);

async function api(path, init = {}, token) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

if (up) {
  // ── The console's own path ──
  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: env.SUPERADMIN_EMAIL, password: env.SUPERADMIN_PASSWORD }),
  });
  check('super admin signs in', login.status === 200, `status ${login.status}`);
  const token = login.body?.data?.token;

  const me = await api('/admin/me', {}, token);
  check('GET /admin/me → superadmin', me.body?.data?.platformRole === 'superadmin');

  const overview = await api('/admin/overview', {}, token);
  const o = overview.body?.data;
  check('overview builds', overview.status === 200, `status ${overview.status}`);
  check('overview has users', o?.users?.value > 0, `users=${o?.users?.value}`);
  check('overview has mosques', o?.mosques?.value > 0, `mosques=${o?.mosques?.value}`);
  check('overview has MRR', o?.mrrCents > 0, `mrr=${o?.mrrCents}`);
  check('overview daily series is 30 days', o?.daily?.length === 30, `${o?.daily?.length}`);
  check('overview has alerts', Array.isArray(o?.alerts), `${o?.alerts?.length} alerts`);

  for (const [name, path] of [
    ['mosques', '/admin/mosques'],
    ['users', '/admin/users'],
    ['invoices', '/admin/billing/invoices'],
    ['billing summary', '/admin/billing/summary'],
    ['subscriptions', '/admin/billing/subscriptions'],
    ['donations', '/admin/billing/donations'],
    ['advertisers', '/admin/advertisers'],
    ['campaigns', '/admin/campaigns'],
    ['tickets', '/admin/support/tickets'],
    ['support stats', '/admin/support/stats'],
    ['activity log', '/admin/audit'],
  ]) {
    const r = await api(path, {}, token);
    const rows =
      r.body?.data?.items?.length ?? (Array.isArray(r.body?.data) ? r.body.data.length : '—');
    check(`GET ${path}`, r.status === 200, `status ${r.status}, ${rows} rows`);
  }

  const audit = await api('/admin/audit', {}, token);
  check(
    'activity log is not empty',
    (audit.body?.data?.total ?? 0) > 0,
    `${audit.body?.data?.total} entries`,
  );

  // ── The app's path ──
  const member = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'yusuf@example.com', password: 'mensemble' }),
  });
  check('member signs in', member.status === 200, `status ${member.status}`);
  const mToken = member.body?.data?.token;

  const feed = await api('/feed', {}, mToken);
  check('feed loads', feed.status === 200, `${feed.body?.data?.length} posts`);

  const ads = await api('/ads/slot?placement=feed&city=montreal&limit=2', {}, mToken);
  check('ad slot serves', ads.status === 200, `${ads.body?.data?.length} ads`);
  if (ads.body?.data?.[0]) {
    const ad = ads.body.data[0];
    check('served ad carries no commercial data', !('budgetCents' in ad) && !('targeting' in ad));
    check('served ad is disclosed', Boolean(ad.disclosure), ad.disclosure);
    const ev = await api(
      `/ads/${ad.campaignId}/events`,
      {
        method: 'POST',
        body: JSON.stringify({ kind: 'impression' }),
      },
      mToken,
    );
    check('impression counted', ev.status === 200);
  }

  // ── The three ways signing in to the console fails ──
  // Each sends whoever hit it somewhere different, so the login page tells
  // them apart rather than saying "could not sign in" three times.
  const wrongPassword = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: env.SUPERADMIN_EMAIL, password: 'not-the-password' }),
  });
  check(
    'wrong password → 401 BAD_CREDENTIALS',
    wrongPassword.status === 401 && wrongPassword.body?.error?.code === 'BAD_CREDENTIALS',
    `${wrongPassword.status} ${wrongPassword.body?.error?.code}`,
  );
  check(
    'wrong password does not reveal whether the email exists',
    !/exist|unknown|no account/i.test(wrongPassword.body?.error?.message ?? ''),
    wrongPassword.body?.error?.message,
  );

  const suspendTarget = await api('/admin/users?q=yusuf', {}, token);
  const yusufId = suspendTarget.body?.data?.items?.[0]?._id;
  await api(`/admin/users/${yusufId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'suspended' }),
  }, token);
  const suspended = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'yusuf@example.com', password: 'mensemble' }),
  });
  check(
    'suspended account → 403 ACCOUNT_SUSPENDED',
    suspended.status === 403 && suspended.body?.error?.code === 'ACCOUNT_SUSPENDED',
    `${suspended.status} ${suspended.body?.error?.code}`,
  );
  const stale = await api('/me', {}, mToken);
  check('a token issued before the suspension stops working', stale.status === 401, `status ${stale.status}`);
  await api(`/admin/users/${yusufId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'active' }),
  }, token);

  // A coordinator must not reach the console.
  const coord = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'khadija.mosque@gmail.com', password: '123456' }),
  });
  const coordAdmin = await api('/admin/overview', {}, coord.body?.data?.token);
  check(
    'coordinator refused from the console',
    coordAdmin.status === 403,
    `status ${coordAdmin.status}`,
  );

  // ── Re-seeding is safe ──
  const reseed = run('npx', ['tsx', 'src/scripts/seed.ts']);
  const reseedCode = await new Promise((r) => reseed.on('exit', r));
  check('re-seed is idempotent', reseedCode === 0, `exit ${reseedCode}`);

  const after = await api('/admin/overview', {}, token);
  check('overview still fine after re-seed', after.status === 200);
}

// ── Down ────────────────────────────────────────────────────────────────────
if (process.platform === 'win32')
  spawn('taskkill', ['/pid', String(server.pid), '/f', '/t'], { stdio: 'ignore' });
else server.kill('SIGTERM');
await sleep(800);
await mongod.stop();

console.log(failed ? `\n[smoke] ${failed} check(s) FAILED` : '\n[smoke] all checks passed');
process.exit(failed ? 1 : 0);
